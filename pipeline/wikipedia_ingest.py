"""
wikipedia_ingest.py
-------------------
Wikipedia REST API → facts (history + wildcard).

Sources:
- On This Day feed:  /api/rest_v1/feed/onthisday/{type}/{MM}/{DD}   → dated events (year_guess fuel)
- Random summaries:  /api/rest_v1/page/random/summary               → wildcard facts
- Pageviews metric:  /metrics/pageviews/per-article/...             → REAL popularity
- MediaWiki API:     /w/api.php                                     → better rate limits
- Wikidata SPARQL:   query.wikidata.org/sparql                      → structured facts
- DBpedia SPARQL:    dbpedia.org/sparql                             → linked open data

Difficulty is popularity-percentile within category (see question_forge), so the
surest way to mint HARD questions is to scrape OBSCURE articles. `--hard` does
exactly that: it oversamples random articles, measures each one's real Wikipedia
pageviews, and keeps only the low-traffic tail — those land at difficulty 5.

Run:
    python wikipedia_ingest.py                     # today's On This Day + 20 random sweeps
    python wikipedia_ingest.py --date 07-20        # a specific MM-DD
    python wikipedia_ingest.py --random 50         # bigger random sweep
    python wikipedia_ingest.py --hard 40           # 40 obscure (low-pageview) facts
    python wikipedia_ingest.py --hard 40 --random 0  # hard-only run (the 6h cron)

Schedule: daily via etl_daily.yml; hard sweep every 6h via wiki_hard.yml
"""

from __future__ import annotations

import argparse
import html
import math
import urllib.parse
from datetime import date, timedelta

from common import console, dump_raw, get_json, get_db, make_fact, upsert_facts, get_request_id

API = "https://en.wikipedia.org/api/rest_v1"
API_MW = "https://en.wikipedia.org/w/api.php"
PAGEVIEWS = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
DBPEDIA_SPARQL = "https://dbpedia.org/sparql"

# A monthly view count of ~3M maps to the top of the 0-100 scale; obscure stubs
# with a few hundred views land near 0 (→ difficulty 5).
_PV_CEILING = math.log10(3_000_000)
# Keep only articles at/below this popularity. Random standard articles have a
# median popularity of ~45 (measured), so 40 keeps the obscure sub-median tail —
# genuinely hard, yet a ~40% hit rate so the quota fills with modest oversampling.
# Difficulty is relative percentile, so the cutoff just sets how deep we fish.
HARD_MAX_POPULARITY = 40.0


def _popularity_from_extract(item: dict) -> float:
    """Cheap popularity proxy for the On This Day feed (no pageview call): linked
    pages with thumbnails and long extracts skew famous."""
    pages = item.get("pages", [])
    score = min(100.0, 30.0 + 14.0 * len(pages))
    if any(p.get("thumbnail") for p in pages):
        score = min(100.0, score + 15.0)
    return score


def _pageviews(title: str) -> int | None:
    """Total pageviews over the trailing ~60 days for an article. None on miss.
    
    With adaptive retry logic in get_json(), this automatically handles rate limits.
    Failures are logged and gracefully degrade the popularity score.
    """
    if not title:
        return None
    end = date.today().replace(day=1)
    start = (end - timedelta(days=60)).replace(day=1)
    slug = urllib.parse.quote(title.replace(" ", "_"), safe="")
    url = (
        f"{PAGEVIEWS}/en.wikipedia.org/all-access/all-agents/{slug}"
        f"/monthly/{start:%Y%m%d}/{end:%Y%m%d}"
    )
    try:
        data = get_json(url)
    except Exception as e:
        console.print(
            f"[yellow][{get_request_id()}] pageviews miss for '{title}': "
            f"{type(e).__name__}[/yellow]"
        )
        return None
    return sum(item.get("views", 0) for item in data.get("items", []))


def _popularity_from_pageviews(views: int | None) -> float:
    """Log-scaled real popularity: a handful of views ⇒ ~1 (hard), millions ⇒ 100."""
    if not views or views < 1:
        return 1.0
    return max(1.0, min(100.0, 100.0 * math.log10(views) / _PV_CEILING))


def fetch_on_this_day(mm: str, dd: str) -> list[dict]:
    """Fetch On This Day feed (events, births, deaths) for a given date.
    
    Makes 3 sequential calls (one per feed). Rate limiting and retries are automatic
    per get_json(), so transient failures are gracefully handled.
    """
    facts = []
    for feed in ("events", "births", "deaths"):
        try:
            data = get_json(f"{API}/feed/onthisday/{feed}/{mm}/{dd}")
        except Exception as e:
            console.print(
                f"[yellow][{get_request_id()}] OnThisDay/{feed} {mm}/{dd} failed: "
                f"{type(e).__name__}[/yellow]"
            )
            continue
        
        for item in data.get(feed, []):
            year = item.get("year")
            text = (item.get("text") or "").strip()
            if not year or not text or len(text) < 25:
                continue
            page = (item.get("pages") or [{}])[0]
            thumb = (page.get("thumbnail") or {}).get("source")
            if feed == "births":
                text = f"{text} was born"
            elif feed == "deaths":
                text = f"{text} died"
            facts.append(
                make_fact(
                    source="wikipedia",
                    category="history",
                    subject=page.get("title", text[:60]).replace("_", " "),
                    fact_text=f"On {mm}/{dd}/{year}: {text}.",
                    year=int(year),
                    image_url=thumb,
                    source_url=(page.get("content_urls", {}).get("desktop", {}) or {}).get("page"),
                    popularity=_popularity_from_extract(item),
                    meta={"feed": feed, "mm": mm, "dd": dd},
                )
            )
    return facts


def fetch_random_summaries(n: int) -> list[dict]:
    """Fetch n random Wikipedia articles with quality gating.
    
    Each call fetches one random summary and quality-gates it (stub check, type check).
    Built-in rate limiting in get_json() prevents hammering the API.
    """
    facts = []
    skipped = 0
    for attempt in range(n * 2):  # Oversample to account for quality filtering
        if len(facts) >= n:
            break
        try:
            s = get_json(f"{API}/page/random/summary")
        except Exception as e:
            console.print(
                f"[yellow][{get_request_id()}] random summary #{attempt} failed: "
                f"{type(e).__name__}[/yellow]"
            )
            skipped += 1
            if skipped > n:  # Give up if we've failed too many times
                break
            continue
        
        extract = (s.get("extract") or "").strip()
        # Skip stubs and disambiguation noise — quality gate from the research doc
        if len(extract) < 120 or s.get("type") != "standard":
            continue
        
        facts.append(
            make_fact(
                source="wikipedia",
                category="wildcard",
                subject=s.get("title", "").replace("_", " "),
                fact_text=extract.split(". ")[0] + ".",
                image_url=(s.get("thumbnail") or {}).get("source"),
                source_url=(s.get("content_urls", {}).get("desktop", {}) or {}).get("page"),
                popularity=40.0,
                meta={"description": s.get("description")},
            )
        )
    
    console.print(
        f"[dim][{get_request_id()}] random sweep: {len(facts)}/{n} kept "
        f"(skipped {skipped})[/dim]"
    )
    return facts


def fetch_random_summaries_mw(n: int) -> list[dict]:
    """Fetch random Wikipedia articles via MediaWiki API (better rate limits).
    
    Falls back to MediaWiki API when REST API is rate-limited. Less aggressive
    request pattern than REST API.
    """
    facts = []
    skipped = 0
    req_id = get_request_id()
    
    for attempt in range(n * 2):
        if len(facts) >= n:
            break
        try:
            # Get random articles
            data = get_json(
                API_MW,
                params={
                    "action": "query",
                    "format": "json",
                    "list": "random",
                    "rnnamespace": "0",
                    "rnlimit": "1",
                },
            )
            pages = data.get("query", {}).get("random", [])
            if not pages:
                continue

            title = pages[0].get("title")
            # Fetch article summary
            page_data = get_json(
                API_MW,
                params={
                    "action": "query",
                    "format": "json",
                    "titles": title,
                    "prop": "extracts|pageimages|info",
                    "explaintext": True,
                    "exintro": True,
                    "piprop": "thumbnail",
                    "pithumbsize": "300",
                },
            )

            pages_dict = page_data.get("query", {}).get("pages", {})
            if not pages_dict:
                continue

            page = list(pages_dict.values())[0]
            extract = (page.get("extract") or "").strip()

            if len(extract) < 120:
                continue

            facts.append(
                make_fact(
                    source="wikipedia",
                    category="wildcard",
                    subject=title,
                    fact_text=extract.split(". ")[0] + ".",
                    image_url=page.get("thumbnail", {}).get("source"),
                    source_url=f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}",
                    popularity=40.0,
                    meta={"description": page.get("description"), "source": "mediawiki_api"},
                )
            )
        except Exception as e:
            console.print(f"[dim][{req_id}] MediaWiki #{attempt}: {type(e).__name__}[/dim]")
            skipped += 1
            if skipped > n:
                break
            continue
    
    console.print(f"[dim][{req_id}] MediaWiki sweep: {len(facts)}/{n} kept[/dim]")
    return facts


def fetch_from_wikidata(n: int = 20) -> list[dict]:
    """Mine trivia facts from Wikidata (structured knowledge base).
    
    Fallback source when Wikipedia REST/MediaWiki APIs are rate-limited.
    Uses SPARQL queries for structured historical facts.
    """
    facts = []
    req_id = get_request_id()

    sparql_queries = [
        # Historical events
        """
        SELECT ?item ?itemLabel ?date ?description WHERE {
            ?item wdt:P279 wd:Q1656682;  # historical event
                  wdt:P585 ?date.
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        } LIMIT 50
        """,
        # Notable discoveries
        """
        SELECT ?item ?itemLabel ?discoverer ?date WHERE {
            ?item wdt:P31 wd:Q2095382;  # discovery
                  wdt:P575 ?date;
                  wdt:P61 ?discoverer.
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        } LIMIT 50
        """,
        # Notable battles
        """
        SELECT ?item ?itemLabel ?date ?description WHERE {
            ?item wdt:P31 wd:Q178561;  # battle
                  wdt:P585 ?date.
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        } LIMIT 50
        """,
    ]

    for query_idx, query in enumerate(sparql_queries):
        if len(facts) >= n:
            break
        try:
            data = get_json(
                WIKIDATA_SPARQL, params={"query": query, "format": "json"}
            )
            for binding in data.get("results", {}).get("bindings", []):
                if len(facts) >= n:
                    break

                item_label = binding.get("itemLabel", {}).get("value", "")
                date_val = binding.get("date", {}).get("value", "")
                description = binding.get("description", {}).get("value", "")

                if not item_label or len(item_label) < 5:
                    continue

                year = None
                if date_val:
                    try:
                        year = int(date_val.split("-")[0])
                    except (ValueError, IndexError):
                        pass

                facts.append(
                    make_fact(
                        source="wikidata",
                        category="history",
                        subject=item_label,
                        fact_text=f"{item_label}: {description or 'A notable historical fact.'}",
                        year=year,
                        popularity=50.0,
                        meta={"source": "wikidata_sparql", "query_idx": query_idx},
                    )
                )
        except Exception as e:
            console.print(f"[dim][{req_id}] Wikidata query {query_idx}: {type(e).__name__}[/dim]")
            continue

    console.print(f"[dim][{req_id}] Wikidata sweep: {len(facts)}/{n} kept[/dim]")
    return facts[:n]


def fetch_from_dbpedia(n: int = 20) -> list[dict]:
    """DBpedia - structured Wikipedia data with SPARQL endpoint.
    
    Final fallback source. Queries linked open data for notable people and facts.
    """
    facts = []
    req_id = get_request_id()

    sparql_query = """
    PREFIX dbpedia: <http://dbpedia.org/resource/>
    PREFIX dbo: <http://dbpedia.org/ontology/>
    PREFIX dbp: <http://dbpedia.org/property/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT DISTINCT ?label ?abstract WHERE {
        ?person a dbo:Person ;
                rdfs:label ?label ;
                dbo:abstract ?abstract .
        FILTER(lang(?label) = "en" && lang(?abstract) = "en")
    } LIMIT 100
    """

    try:
        data = get_json(
            DBPEDIA_SPARQL, params={"query": sparql_query, "format": "json"}
        )
        for binding in data.get("results", {}).get("bindings", []):
            if len(facts) >= n:
                break

            label = binding.get("label", {}).get("value", "")
            abstract = binding.get("abstract", {}).get("value", "")

            if not label or len(abstract) < 100:
                continue

            facts.append(
                make_fact(
                    source="dbpedia",
                    category="history",
                    subject=label,
                    fact_text=abstract.split(". ")[0] + ".",
                    popularity=50.0,
                    meta={"source": "dbpedia_sparql"},
                )
            )
    except Exception as e:
        console.print(f"[dim][{req_id}] DBpedia query: {type(e).__name__}[/dim]")

    console.print(f"[dim][{req_id}] DBpedia sweep: {len(facts)}/{n} kept[/dim]")
    return facts[:n]


def fetch_hard(n: int, oversample: int = 5, max_popularity: float = HARD_MAX_POPULARITY) -> list[dict]:
    """Mint EXTREMELY DIFFICULT facts by mining obscure articles.

    Pulls ~oversample×n random standard articles, measures each one's real
    Wikipedia pageviews, and keeps only the low-traffic tail (popularity below
    max_popularity). Those facts carry a tiny popularity score, so the forge's
    percentile engine ranks them difficulty 5 within their category.
    
    Implements intelligent fallback chain:
    1. Try Wikipedia REST API (primary, fastest)
    2. Fall back to MediaWiki API (better rate limits)
    3. Fall back to Wikidata SPARQL (structured, different approach)
    4. Fall back to DBpedia SPARQL (linked data, final option)
    
    Rate limiting and retries are automatic per get_json(). Graceful degradation:
    if a pageviews call fails, uses nominal popularity and continues.
    """
    kept: list[dict] = []
    seen: set[str] = set()
    attempts = 0
    budget = max(n * oversample, n + 10)
    pv_calls_failed = 0
    random_calls_failed = 0
    req_id = get_request_id()
    
    console.print(f"[dim][{req_id}] Primary: attempting Wikipedia REST API hard sweep...[/dim]")
    
    while len(kept) < n and attempts < budget:
        attempts += 1
        
        # Fetch a random summary with built-in retry/rate-limit handling
        try:
            s = get_json(f"{API}/page/random/summary")
        except Exception as e:
            random_calls_failed += 1
            console.print(
                f"[yellow][{req_id}] hard #{attempts}: random failed "
                f"({type(e).__name__})[/yellow]"
            )
            break  # Exit primary loop on first error, try fallbacks
        
        title = (s.get("title") or "").replace("_", " ")
        extract = (s.get("extract") or "").strip()
        
        # Quality gates: title, dedup, type, extract length
        if not title or title in seen or s.get("type") != "standard" or len(extract) < 120:
            continue
        
        seen.add(title)
        
        # Query pageviews for this article to determine popularity
        # Graceful degradation: if pageviews fails, use nominal score
        views = _pageviews(title)
        if views is None:
            pv_calls_failed += 1
            # Even if pageviews fails, assign nominal popularity and include it
            pop = 50.0
        else:
            pop = _popularity_from_pageviews(views)
        
        # Keep only articles below the popularity threshold
        if pop > max_popularity:
            continue
        
        # Infer category from description
        year = None
        desc = (s.get("description") or "").lower()
        category = "history" if any(w in desc for w in ("politician", "war", "battle", "empire", "dynasty", "historian", "ancient")) else "wildcard"
        
        kept.append(
            make_fact(
                source="wikipedia",
                category=category,
                subject=title,
                fact_text=extract.split(". ")[0] + ".",
                year=year,
                image_url=(s.get("thumbnail") or {}).get("source"),
                source_url=(s.get("content_urls", {}).get("desktop", {}) or {}).get("page"),
                popularity=pop,
                meta={"description": s.get("description"), "hard": True, "source": "wikipedia_api"},
            )
        )
    
    # Fallback 1: MediaWiki API
    if len(kept) < n // 2:
        console.print(f"[dim][{req_id}] Fallback 1/3: Trying MediaWiki API ({len(kept)}/{n} facts)...[/dim]")
        try:
            mw_facts = fetch_random_summaries_mw(n - len(kept))
            # For MediaWiki, we skip pageviews check and trust the API; add them as-is
            kept.extend(mw_facts[:n - len(kept)])
        except Exception as e:
            console.print(f"[dim][{req_id}] MediaWiki fallback failed: {type(e).__name__}[/dim]")

    # Fallback 2: Wikidata
    if len(kept) < n // 2:
        console.print(f"[dim][{req_id}] Fallback 2/3: Trying Wikidata SPARQL ({len(kept)}/{n} facts)...[/dim]")
        try:
            wd_facts = fetch_from_wikidata(n - len(kept))
            kept.extend(wd_facts[:n - len(kept)])
        except Exception as e:
            console.print(f"[dim][{req_id}] Wikidata fallback failed: {type(e).__name__}[/dim]")

    # Fallback 3: DBpedia
    if len(kept) < n // 2:
        console.print(f"[dim][{req_id}] Fallback 3/3: Trying DBpedia SPARQL ({len(kept)}/{n} facts)...[/dim]")
        try:
            db_facts = fetch_from_dbpedia(n - len(kept))
            kept.extend(db_facts[:n - len(kept)])
        except Exception as e:
            console.print(f"[dim][{req_id}] DBpedia fallback failed: {type(e).__name__}[/dim]")

    console.print(
        f"[dim][{req_id}] hard sweep: kept {len(kept)}/{n} after {attempts} REST draws "
        f"+ fallbacks (random_failed={random_calls_failed}, pv_failed={pv_calls_failed})[/dim]"
    )
    return kept


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="MM-DD (default: today)")
    ap.add_argument("--random", type=int, default=20, help="random summary sweep size")
    ap.add_argument("--hard", type=int, default=0, help="number of obscure (low-pageview) hard facts to mine")
    args = ap.parse_args()

    facts: list[dict] = []
    req_id = get_request_id()
    console.print(f"[dim]Request ID: {req_id}[/dim]")
    
    if args.hard:
        console.rule(f"[bold]Wikipedia HARD sweep — {args.hard} obscure facts")
        facts += fetch_hard(args.hard)
    if args.random or not args.hard:
        mm, dd = (args.date or date.today().strftime("%m-%d")).split("-")
        console.rule(f"[bold]Wikipedia ingest — onthisday {mm}/{dd} + {args.random} random")
        facts += fetch_on_this_day(mm, dd) + fetch_random_summaries(args.random)

    dump_raw("wikipedia", facts)
    n = upsert_facts(get_db(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


if __name__ == "__main__":
    main()
