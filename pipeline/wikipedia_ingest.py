"""
wikipedia_ingest.py
-------------------
Wikipedia REST API → facts (history + wildcard).

Sources:
- On This Day feed:  /api/rest_v1/feed/onthisday/{type}/{MM}/{DD}   → dated events (year_guess fuel)
- Random summaries:  /api/rest_v1/page/random/summary               → wildcard facts

Run:
    python wikipedia_ingest.py                     # today's On This Day + 20 random sweeps
    python wikipedia_ingest.py --date 07-20        # a specific MM-DD
    python wikipedia_ingest.py --random 50         # bigger random sweep

Schedule: daily via .github/workflows/etl_daily.yml
"""

from __future__ import annotations

import argparse
from datetime import date

from common import console, dump_raw, get_json, get_supabase, make_fact, upsert_facts

API = "https://en.wikipedia.org/api/rest_v1"


def _popularity_from_extract(item: dict) -> float:
    """Cheap popularity proxy until the pageviews enricher lands: linked pages
    with thumbnails and long extracts skew famous."""
    pages = item.get("pages", [])
    score = min(100.0, 30.0 + 14.0 * len(pages))
    if any(p.get("thumbnail") for p in pages):
        score = min(100.0, score + 15.0)
    return score


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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="MM-DD (default: today)")
    ap.add_argument("--random", type=int, default=20, help="random summary sweep size")
    args = ap.parse_args()

    mm, dd = (args.date or date.today().strftime("%m-%d")).split("-")
    console.rule(f"[bold]Wikipedia ingest — onthisday {mm}/{dd} + {args.random} random")

    facts = fetch_on_this_day(mm, dd) + fetch_random_summaries(args.random)
    dump_raw("wikipedia", facts)
    n = upsert_facts(get_supabase(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


if __name__ == "__main__":
    main()
