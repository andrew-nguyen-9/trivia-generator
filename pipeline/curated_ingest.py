"""
curated_ingest.py
-----------------
A small, hand-verified set of NOTABLE facts — the only ingest that needs no
network. The nightly scrapers pull broad-but-obscure Wikipedia stubs (random
SSSIs, minor houses) with no `year`, which starves two games in DB-less mode:

- THE CLOCK (2.4) has no `year_guess` fuel offline (every scraped fact's year
  is null), so its dated rounds only work against a live DB.
- THE THREAD (2.8) chains masked clues, so obscure subjects make unrecognizable
  chains — the master theme is meant to be guessable.

This ingest seeds recognizable, dated, theme-tagged facts so both play offline.
Facts here describe their subject WITHOUT naming it (so `forge_clues`'
`mask_subject` keeps them) and embed " in {year}" where dated (so
`forge_year_guess` can strip the give-away). The cosmos/egypt pools are dense
enough that the greedy last-letter→first-letter walk in `forge_thread` finds a
recognizable ≥5-link chain.

Run:
    python curated_ingest.py            # append to bronze (+ DB if configured)

Schedule: not on the daily cron — this is a curated baseline, run on demand.
"""

from __future__ import annotations

import argparse

from common import console, dump_raw, get_db, make_fact, upsert_facts

# (subject, category, fact_text, year, popularity)
# fact_text must NOT contain the subject's name (mask_subject would blank it or
# drop the clue) and SHOULD carry a board-theme keyword (see BOARD_THEME_KEYWORDS:
# cosmos = space/star/planet/galaxy/moon/comet/orbit; egypt = egypt/nile/pharaoh/
# pyramid/cairo/sphinx; voyage = sea/ship/ocean/island/voyage/sail/port/coast).
_FACTS: list[tuple[str, str, str, int | None, float]] = [
    # ── THE COSMOS (guaranteed chain: Mars→Saturn→Neil Armstrong→Galileo→Io→Orion) ──
    ("Mars", "wildcard", "Known as the red planet, it is the fourth planet from the Sun and home to the Solar System's tallest volcano.", None, 92),
    ("Saturn", "wildcard", "This ringed planet is the sixth from the Sun and the second-largest in the Solar System.", None, 90),
    ("Neil Armstrong", "history", "This astronaut became the first person to walk on the Moon in 1969.", 1969, 95),
    ("Galileo Galilei", "history", "This Italian astronomer improved the telescope and discovered the four largest moons of Jupiter.", None, 88),
    ("Io", "wildcard", "The most volcanically active body known, this moon orbits Jupiter.", None, 58),
    ("Orion", "wildcard", "This constellation of bright stars, including Betelgeuse and Rigel, depicts a hunter.", None, 76),
    ("Sputnik", "history", "Launched in 1957, it was the first artificial satellite to orbit the Earth.", 1957, 80),
    ("Apollo", "history", "This NASA program first landed astronauts on the Moon between 1969 and 1972.", None, 85),
    ("Hubble", "wildcard", "This telescope was carried into orbit by a Space Shuttle in 1990 and still images deep space.", 1990, 78),
    # ── EGYPT (guaranteed chain: Cleopatra→Anubis→Sahara→Akhenaten→Nile) ──
    ("Cleopatra", "history", "The last active pharaoh of ancient Egypt, she allied with Rome's Julius Caesar and Mark Antony.", None, 90),
    ("Anubis", "history", "This jackal-headed Egyptian god watched over mummification and the dead.", None, 70),
    ("Sahara", "geography", "Stretching across North Africa beside the Nile, it is the largest hot desert on Earth.", None, 75),
    ("Akhenaten", "history", "This pharaoh tried to refocus Egyptian worship on the sun disk Aten.", None, 55),
    ("Nile", "geography", "The pyramids of Giza rise beside this great river, the lifeblood of ancient Egypt.", None, 85),
    ("Sphinx", "history", "This great limestone statue with a lion's body and a human head guards the Giza pyramids.", None, 80),
    ("Tutankhamun", "history", "This boy pharaoh's nearly intact tomb was discovered in 1922.", 1922, 82),
    ("Giza", "geography", "This plateau outside Cairo is the site of the Great Pyramid.", None, 78),
    # ── DATED FACTS for THE CLOCK (year_guess fuel, recognizable) ──
    ("Eiffel Tower", "geography", "This wrought-iron tower in Paris was completed in 1889 for a World's Fair.", 1889, 88),
    ("Titanic", "history", "On its maiden voyage in 1912, this ocean liner sank after striking an iceberg.", 1912, 90),
    ("Berlin Wall", "history", "This barrier dividing a German city was opened and torn down in 1989.", 1989, 84),
    ("Wright Flyer", "history", "The first sustained, controlled powered aeroplane flight was made in 1903 at Kitty Hawk.", 1903, 72),
    ("Penicillin", "wildcard", "Alexander Fleming discovered this first true antibiotic in 1928.", 1928, 70),
    ("World Wide Web", "wildcard", "Tim Berners-Lee released this hyperlinked information system to the public in 1991.", 1991, 80),
    ("iPhone", "screen", "Apple unveiled this touchscreen smartphone in 2007, reshaping the industry.", 2007, 86),
]


# THE CLOCK audio rounds (folded Jukebox): recognizable PUBLIC-DOMAIN melodies as
# offline note lists (no audio files — synthesized by lib/sound.ts playMelody), each
# with a composition/publication year. forge_audio turns these into "when was this
# first heard?" rounds; the melody is carried in meta so make_fact stays generic.
# Note = {"n": scientific-pitch | "rest", "d": beats}.
_MELODIES: list[tuple[str, int, list[dict]]] = [
    ("Beethoven's Fifth Symphony", 1808, [
        {"n": "G4", "d": 0.5}, {"n": "G4", "d": 0.5}, {"n": "G4", "d": 0.5}, {"n": "D#4", "d": 1.5},
        {"n": "F4", "d": 0.5}, {"n": "F4", "d": 0.5}, {"n": "F4", "d": 0.5}, {"n": "D4", "d": 1.5},
    ]),
    ("Ode to Joy", 1824, [
        {"n": "E4", "d": 1}, {"n": "E4", "d": 1}, {"n": "F4", "d": 1}, {"n": "G4", "d": 1},
        {"n": "G4", "d": 1}, {"n": "F4", "d": 1}, {"n": "E4", "d": 1}, {"n": "D4", "d": 1},
        {"n": "C4", "d": 1}, {"n": "C4", "d": 1}, {"n": "D4", "d": 1}, {"n": "E4", "d": 1},
        {"n": "E4", "d": 1.5}, {"n": "D4", "d": 0.5}, {"n": "D4", "d": 2},
    ]),
    ("Für Elise", 1810, [
        {"n": "E5", "d": 0.5}, {"n": "D#5", "d": 0.5}, {"n": "E5", "d": 0.5}, {"n": "D#5", "d": 0.5},
        {"n": "E5", "d": 0.5}, {"n": "B4", "d": 0.5}, {"n": "D5", "d": 0.5}, {"n": "C5", "d": 0.5},
        {"n": "A4", "d": 1.5},
    ]),
    ("Jingle Bells", 1857, [
        {"n": "E4", "d": 1}, {"n": "E4", "d": 1}, {"n": "E4", "d": 2},
        {"n": "E4", "d": 1}, {"n": "E4", "d": 1}, {"n": "E4", "d": 2},
        {"n": "E4", "d": 1}, {"n": "G4", "d": 1}, {"n": "C4", "d": 1.5}, {"n": "D4", "d": 0.5}, {"n": "E4", "d": 3},
    ]),
    ("Happy Birthday to You", 1893, [
        {"n": "G4", "d": 0.75}, {"n": "G4", "d": 0.25}, {"n": "A4", "d": 1}, {"n": "G4", "d": 1},
        {"n": "C5", "d": 1}, {"n": "B4", "d": 2},
    ]),
]


def build_facts() -> list[dict]:
    out = []
    for subject, category, text, year, pop in _FACTS:
        out.append(
            make_fact(
                source="curated",
                category=category,
                subject=subject,
                fact_text=text,
                year=year,
                popularity=float(pop),
                source_url=f"https://en.wikipedia.org/wiki/{subject.replace(' ', '_')}",
            )
        )
    for subject, year, melody in _MELODIES:
        out.append(
            make_fact(
                source="curated",
                category="music",
                subject=subject,
                fact_text="Listen closely — in what year was this melody first heard?",
                year=year,
                popularity=85.0,
                source_url=f"https://en.wikipedia.org/wiki/{subject.replace(' ', '_')}",
                meta={"melody": melody},
            )
        )
    return out


def main() -> None:
    argparse.ArgumentParser().parse_args()
    facts = build_facts()
    dump_raw("curated", facts)
    n = upsert_facts(get_db(), facts)
    console.print(f"[green]✓ {len(facts)} curated facts collected, {n} upserted[/green]")


if __name__ == "__main__":
    main()
