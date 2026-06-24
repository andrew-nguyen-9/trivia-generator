"""
wiki_pkg_ingest.py
------------------
Breadth source using the `wikipedia` PyPI package (`pip install wikipedia`).

Note: the repo's primary Wikipedia source is `wikipedia_ingest.py` (REST API +
real pageview popularity + Wikidata SPARQL) — strictly richer than this package,
which scrapes article HTML and gives no popularity signal. This module exists as
the explicitly-requested `pip install wikipedia` path and as a cheap breadth
top-up. It pulls the lead sentence of well-known subjects (so facts read as real
trivia, not random obscure stubs) and emits one fact each.

The `wikipedia` import is guarded: if the package isn't installed the module is a
no-op (prints a hint and exits 0) so it can never break the nightly run.

Run:
    python wiki_pkg_ingest.py                 # curated notable topics
    python wiki_pkg_ingest.py --random 30     # 30 random articles too (noisier)
Schedule: optional daily step in etl_daily.yml (continue-on-error).
"""

from __future__ import annotations

import argparse
import re

from common import console, dump_raw, get_db, make_fact, upsert_facts

try:
    import wikipedia  # type: ignore
except Exception:  # ModuleNotFoundError or import-time failure
    wikipedia = None

# Curated, broadly-known subjects per PARLOR category — keeps facts trivia-grade.
TOPICS: dict[str, list[str]] = {
    "history": [
        "Roman Empire", "French Revolution", "World War II", "Ancient Egypt",
        "Cleopatra", "Industrial Revolution", "Cold War", "Renaissance",
        "Genghis Khan", "Berlin Wall", "Apollo 11", "Magna Carta",
    ],
    "geography": [
        "Mount Everest", "Amazon River", "Sahara", "Nile", "Great Barrier Reef",
        "Mariana Trench", "Iceland", "Mount Kilimanjaro", "Lake Baikal", "Antarctica",
    ],
    "music": [
        "The Beatles", "Ludwig van Beethoven", "Jazz", "Bob Dylan", "Hip hop",
        "Wolfgang Amadeus Mozart", "Queen (band)", "Aretha Franklin",
    ],
    "screen": [
        "Citizen Kane", "Alfred Hitchcock", "Star Wars", "The Godfather",
        "Studio Ghibli", "Akira Kurosawa", "The Simpsons",
    ],
    "sports": [
        "Olympic Games", "Pelé", "Muhammad Ali", "Wimbledon", "Tour de France",
        "Serena Williams", "Michael Jordan", "FIFA World Cup",
    ],
    "wildcard": [
        "Photosynthesis", "Black hole", "DNA", "Periodic table", "Volcano",
        "Honey bee", "Great Wall of China", "Leonardo da Vinci",
    ],
}

_FIRST_SENTENCE = re.compile(r"^(.+?[.!?])(?:\s|$)")


def _lead_sentence(text: str) -> str | None:
    text = (text or "").strip().replace("\n", " ")
    m = _FIRST_SENTENCE.match(text)
    s = m.group(1) if m else text
    return s if len(s) >= 25 else None


def _fact_from_title(title: str, category: str) -> dict | None:
    try:
        summary = wikipedia.summary(title, sentences=2, auto_suggest=False)
    except Exception:
        return None  # disambiguation, missing page, network — just skip
    sentence = _lead_sentence(summary)
    if not sentence:
        return None
    subject = title.split(" (")[0]  # drop "(band)" / "(film)" qualifiers
    return make_fact(
        source="wikipedia_pkg",
        category=category,
        subject=subject,
        fact_text=sentence,
        source_url=f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
        meta={"wiki_pkg": True},
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="wikipedia-package breadth ingest")
    ap.add_argument("--random", type=int, default=0, help="extra random articles (noisier)")
    args = ap.parse_args()

    if wikipedia is None:
        console.print("[yellow]`wikipedia` package not installed — skipping "
                      "(pip install wikipedia). No-op.[/yellow]")
        return

    wikipedia.set_lang("en")
    facts: list[dict] = []
    for category, titles in TOPICS.items():
        for t in titles:
            f = _fact_from_title(t, category)
            if f:
                facts.append(f)

    for title in (wikipedia.random(pages=args.random) if args.random else []):
        f = _fact_from_title(title, "wildcard")
        if f:
            facts.append(f)

    if not facts:
        console.print("[yellow]wiki_pkg: no facts collected[/yellow]")
        return

    dump_raw("wikipedia_pkg", facts)
    conn = get_db()
    if conn:
        n = upsert_facts(conn, facts)
        console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")
    else:
        console.print(f"[green]✓ {len(facts)} facts collected (bronze-only mode)[/green]")


if __name__ == "__main__":
    main()
