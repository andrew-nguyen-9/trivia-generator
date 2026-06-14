"""
export_seed.py
--------------
Exports the freshest question bank to frontend/public/seed-questions.json so the
app stays fully playable with zero backend (offline mode). The committed seed in
the repo is hand-curated; this script replaces it with pipeline output once the
ETL is live. Runs last in etl_daily.yml.

Run:
    python export_seed.py                # from Supabase
    python export_seed.py --from-bronze  # offline: forge from data/raw and export
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import REPO_ROOT, console, get_supabase
from question_forge import forge_all, load_facts_from_bronze

SEED_PATH = REPO_ROOT / "frontend" / "public" / "seed-questions.json"
PER_TYPE_CAP = 120  # keep the payload lean — the app samples client-side anyway

FIELDS = [
    "qtype", "category", "difficulty", "prompt", "correct", "choices",
    "year", "value_a", "value_b", "subject_a", "subject_b", "unit",
    "lat", "lng", "image_url", "source_url", "audio_url", "melody", "groups",
]


def slim(q: dict) -> dict:
    return {k: q.get(k) for k in FIELDS if q.get(k) is not None}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-bronze", action="store_true")
    args = ap.parse_args()

    sb = None if args.from_bronze else get_supabase()
    if sb is None:
        questions = forge_all(load_facts_from_bronze())
    else:
        questions = sb.table("questions").select("*").limit(5000).execute().data or []

    by_type: dict[str, list[dict]] = {}
    for q in sorted(questions, key=lambda q: q.get("difficulty", 3)):
        rows = by_type.setdefault(q["qtype"], [])
        if len(rows) < PER_TYPE_CAP:
            rows.append(slim(q))

    flat = [q for rows in by_type.values() for q in rows]
    if len(flat) < 20:
        raise SystemExit(f"refusing to export a thin seed bank ({len(flat)} questions) — keeping the committed one")

    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEED_PATH.write_text(json.dumps({"questions": flat}, indent=1))
    console.print(f"[green]✓ exported {len(flat)} questions → {SEED_PATH.relative_to(REPO_ROOT)}[/green]")


if __name__ == "__main__":
    main()
