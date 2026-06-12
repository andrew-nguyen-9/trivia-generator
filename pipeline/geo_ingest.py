"""
geo_ingest.py
-------------
restcountries.com → facts (geography). Zero auth.

One API sweep yields three kinds of game fuel per country:
- population / area      → higher_lower (THE STREAK)
- capital (answer_field) → multiple_choice (THE WEDGES)
- capital coordinates    → where (THE MAP)

Run:
    python geo_ingest.py
    python geo_ingest.py --min-population 5000000

Schedule: daily via etl_daily.yml (the dataset barely changes; the upserts no-op)
"""

from __future__ import annotations

import argparse
import math

from common import console, dump_raw, get_json, get_supabase, make_fact, upsert_facts

API = "https://restcountries.com/v3.1/all"
FIELDS = "name,capital,capitalInfo,population,area,region,flags,maps"


def _popularity(population: int) -> float:
    # log-scale population → 0-100 (1B people ≈ 100); mirrors the Deezer proxy
    return min(100.0, math.log10(max(1, population)) / math.log10(1_000_000_000) * 100)


def facts_for_country(c: dict) -> list[dict]:
    name = (c.get("name") or {}).get("common")
    if not name:
        return []
    population = c.get("population") or 0
    area = c.get("area") or 0
    capital = (c.get("capital") or [None])[0]
    latlng = (c.get("capitalInfo") or {}).get("latlng") or []
    flag = (c.get("flags") or {}).get("svg")
    url = (c.get("maps") or {}).get("openStreetMaps")
    pop_score = _popularity(population)

    out = [
        make_fact(
            source="restcountries", category="geography", subject=name,
            fact_text=f"{name} has a population of {population:,}.",
            numeric_value=float(population), numeric_unit="population",
            image_url=flag, source_url=url, popularity=pop_score,
            meta={"region": c.get("region")},
        ),
        make_fact(
            source="restcountries", category="geography", subject=name,
            fact_text=f"{name} covers {int(area):,} km².",
            numeric_value=float(area), numeric_unit="area (km²)",
            image_url=flag, source_url=url, popularity=pop_score,
            meta={"region": c.get("region")},
        ),
    ]
    if capital and len(latlng) == 2:
        out.append(
            make_fact(
                source="restcountries", category="geography", subject=name,
                fact_text=f"{capital} is the capital of {name}.",
                lat=float(latlng[0]), lng=float(latlng[1]),
                image_url=flag, source_url=url, popularity=pop_score,
                meta={"answer_field": "capital", "answer": capital, "region": c.get("region")},
            )
        )
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-population", type=int, default=1_000_000,
                    help="skip microstates below this population (distractor quality)")
    args = ap.parse_args()

    console.rule("[bold]Geography ingest — restcountries")
    countries = get_json(API, params={"fields": FIELDS})

    facts: list[dict] = []
    for c in countries:
        if (c.get("population") or 0) < args.min_population:
            continue
        try:
            facts.extend(facts_for_country(c))
        except Exception as e:
            console.print(f"[yellow]skip {(c.get('name') or {}).get('common')}: {e}[/yellow]")

    dump_raw("geography", facts)
    n = upsert_facts(get_supabase(), facts)
    console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")


if __name__ == "__main__":
    main()
