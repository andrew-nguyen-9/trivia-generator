"""
wikipedia_ingest.py
-------------------
Wikipedia REST API → facts (history + wildcard).

Sources:
- On This Day feed:  /api/rest_v1/feed/onthisday/{type}/{MM}/{DD}   → dated events (year_guess fuel)
- Random summaries:  /api/rest_v1/page/random/summary               → wildcard facts
- Pageviews metric:  /metrics/pageviews/per-article/...             → REAL popularity

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
import math
import urllib.parse
from datetime import date, timedelta

from common import console, dump_raw, get_json, get_db, make_fact, upsert_facts

API = "https://en.wikipedia.org/api/rest_v1"
PAGEVIEWS = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"

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
    """Total pageviews over the trailing ~60 days for an article. None on miss."""
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
    except Exception:
        return None
    return sum(item.get("views", 0) for item in data.get("items", []))


def _popularity_from_pageviews(views: int | None) -> float:
    """Log-scaled real popularity: a handful of views ⇒ ~1 (hard), millions ⇒ 100."""
    if not views or views < 1:
        return 1.0
    return max(1.0, min(100.0, 100.0 * math.log10(views) / _PV_CEILING))


def fetch_on_this_day(mm: str, dd: str) -> list[dict]:
    facts = []
    for feed in ("events", "births", "deaths"):
        data = get_json(f"{API}/feed/onthisday/{feed}/{mm}/{dd}")
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
    facts = []
    for _ in range(n):
        s = get_json(f"{API}/page/random/summary")
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
    return facts


def fetch_hard(n: int, oversample: int = 5, max_popularity: float = HARD_MAX_POPULARITY) -> list[dict]:
    """Mint EXTREMELY DIFFICULT facts by mining obscure articles.

    Pulls ~oversample×n random standard articles, measures each one's real
    Wikipedia pageviews, and keeps only the low-traffic tail (popularity below
    max_popularity). Those facts carry a tiny popularity score, so the forge's
    percentile engine ranks them difficulty 5 within their category.
    """
    kept: list[dict] = []
    seen: set[str] = set()
    attempts = 0
    budget = max(n * oversample, n + 10)
    while len(kept) < n and attempts < budget:
        attempts += 1
        s = get_json(f"{API}/page/random/summary")
        title = (s.get("title") or "").replace("_", " ")
        extract = (s.get("extract") or "").strip()
        if not title or title in seen or s.get("type") != "standard" or len(extract) < 120:
            continue
        seen.add(title)
        pop = _popularity_from_pageviews(_pageviews(title))
        if pop > max_popularity:
            continue  # too famous to be hard — drop it
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
                meta={"description": s.get("description"), "hard": True},
            )
        )
    console.print(f"[dim]hard sweep: kept {len(kept)}/{n} after {attempts} draws[/dim]")
    return kept


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="MM-DD (default: today)")
    ap.add_argument("--random", type=int, default=20, help="random summary sweep size")
    ap.add_argument("--hard", type=int, default=0, help="number of obscure (low-pageview) hard facts to mine")
    args = ap.parse_args()

    facts: list[dict] = []
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
