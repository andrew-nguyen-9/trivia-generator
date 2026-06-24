"""
export_seed.py
--------------
Exports the freshest question bank to frontend/public/seed-questions.json so the
app stays fully playable with zero backend (offline mode). The committed seed in
the repo is hand-curated; this script replaces it with pipeline output once the
ETL is live. Runs last in etl_daily.yml.

Run:
    python export_seed.py                # from the database (Neon)
    python export_seed.py --from-bronze  # offline: forge from data/raw and export
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict, deque
from pathlib import Path

from common import REPO_ROOT, console, fetch_all, get_db
from question_forge import forge_all, load_facts_from_bronze

SEED_PATH = REPO_ROOT / "frontend" / "public" / "seed-questions.json"
PER_TYPE_CAP = 200  # offline bank size per type. In DB-less mode the seed bank IS
# the database, so this caps how many forged questions reach players; raised from
# 120 (2.x pipeline fix) now that the Wikipedia bronze is healthy. Live Neon holds
# the full forge output regardless — this only bounds the committed JSON payload.

FIELDS = [
    "qtype", "category", "difficulty", "prompt", "correct", "choices",
    "year", "value_a", "value_b", "subject_a", "subject_b", "unit",
    "lat", "lng", "image_url", "source_url", "audio_url", "melody", "groups",
    "clues",       # seance: ordered clue strings
    "candidates",  # ladder: [{label, category, region, magnitude}]
    "chain",       # thread: [{prompt, answer, link}]
    "theme",       # thread: master theme (final answer)
    "theme_choices",  # thread: final-guess choices (theme included)
]


def slim(q: dict) -> dict:
    return {k: q.get(k) for k in FIELDS if q.get(k) is not None}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-bronze", action="store_true")
    args = ap.parse_args()

    conn = None if args.from_bronze else get_db()
    if conn is None:
        questions = forge_all(load_facts_from_bronze())
    else:
        questions = fetch_all(conn, "select * from questions", limit=5000)

    # Stratified per-type sampling. Naive "sort by difficulty, take first CAP"
    # silently collapses the board's difficulty spread once the bank grows large
    # (the cap fills entirely with tier-1/2 questions), which then trips the
    # board-ready-spread guard below and freezes the bank forever. Instead, draw
    # round-robin across every (difficulty, category) bucket so the capped set
    # keeps the full spread the forge produced. (2.x pipeline fix.)
    by_type: dict[str, list[dict]] = {}
    by_type_groups: dict[str, dict[tuple, deque]] = defaultdict(lambda: defaultdict(deque))
    for q in questions:
        key = (q.get("difficulty", 3), q.get("category"))
        by_type_groups[q["qtype"]][key].append(q)

    for qtype, groups in by_type_groups.items():
        keys = list(groups.keys())
        picked: list[dict] = []
        i = 0
        while len(picked) < PER_TYPE_CAP and any(groups[k] for k in keys):
            k = keys[i % len(keys)]
            if groups[k]:
                picked.append(slim(groups[k].popleft()))
            i += 1
        by_type[qtype] = picked

    flat = [q for rows in by_type.values() for q in rows]
    if len(flat) < 20:
        raise SystemExit(f"refusing to export a thin seed bank ({len(flat)} questions) — keeping the committed one")

    # Never let a single-source bronze (e.g. a wikipedia-only hard sweep) clobber
    # a richer, already-committed bank with a regressed one. Same bar selftest.py
    # holds the bank to: ≥3 categories with a board-ready (≥3 tier) difficulty spread.
    clues = [q for q in flat if q["qtype"] == "clue"]
    new_spread = sum(
        1 for c in {q["category"] for q in clues}
        if len({q["difficulty"] for q in clues if q["category"] == c}) >= 3
    )
    if SEED_PATH.exists():
        old_clues = [q for q in json.loads(SEED_PATH.read_text())["questions"] if q["qtype"] == "clue"]
        old_spread = sum(
            1 for c in {q["category"] for q in old_clues}
            if len({q["difficulty"] for q in old_clues if q["category"] == c}) >= 3
        )
        if new_spread < min(3, old_spread):
            raise SystemExit(
                f"refusing to export — new bank has board-ready spread in {new_spread} "
                f"categories, committed bank has {old_spread}. Likely a thin/single-source "
                f"bronze (e.g. DB-less export with only one ingest's facts) — keeping the committed one."
            )

    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEED_PATH.write_text(json.dumps({"questions": flat}, indent=1))
    console.print(f"[green]✓ exported {len(flat)} questions → {SEED_PATH.relative_to(REPO_ROOT)}[/green]")


if __name__ == "__main__":
    main()
