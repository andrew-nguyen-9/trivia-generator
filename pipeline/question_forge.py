"""
question_forge.py
-----------------
The heart of PARLOR: turns structured FACTS into typed QUESTIONS.
One fact, many games — see docs/RESEARCH_TRIVIA_SOURCES.md §2.

Recipes:
- year_guess      any fact with a year                       → THE CLOCK
- higher_lower    pair facts sharing numeric_unit (min gap)  → THE STREAK
- multiple_choice facts with meta.answer_field, distractors
                  sampled from category siblings             → THE WEDGES
- clue            answer-phrased declarative from fact_text  → THE BOARD / THE THREAD
- where           any fact with lat/lng coordinates          → THE MAP
- seance          ≥3 facts per subject, ordered vague→spec   → THE SÉANCE  (Phase 6)
- ladder          numeric sibling pool around a target       → THE LADDER   (Phase 7)

Difficulty = popularity percentile within category (popular ⇒ easy).

Run:
    python question_forge.py                 # facts from the DB (Neon) → questions + today's daily board
    python question_forge.py --from-bronze   # offline: read data/raw/*.jsonl instead

Schedule: daily via etl_daily.yml (after ingests + dbt build)
"""

from __future__ import annotations

import argparse
import json
import math
import random
from datetime import date
from pathlib import Path

from common import (
    RAW_DIR,
    console,
    content_hash,
    fetch_all,
    get_db,
    upsert_daily_set,
    upsert_questions,
)

MIN_HL_GAP_RATIO = 0.25  # higher/lower pairs must differ by ≥25% — never a coin flip
MIN_SEANCE_CLUES = 3     # minimum facts per subject to forge a séance question
LADDER_CANDIDATES = 6    # candidate pool size per ladder question


# ── difficulty ──────────────────────────────────────────────────────────────
def assign_difficulty(facts: list[dict]) -> None:
    """popularity percentile within category → difficulty 1 (easy) … 5 (hard)."""
    by_cat: dict[str, list[dict]] = {}
    for f in facts:
        by_cat.setdefault(f["category"], []).append(f)
    for rows in by_cat.values():
        ranked = sorted(rows, key=lambda f: -(f.get("popularity") or 0))
        n = max(1, len(ranked))
        for i, f in enumerate(ranked):
            f["_difficulty"] = min(5, 1 + int(5 * i / n))


# ── recipes ─────────────────────────────────────────────────────────────────
def forge_year_guess(facts: list[dict]) -> list[dict]:
    out = []
    for f in facts:
        year = f.get("year")
        if not year or year < 1800:
            continue
        prompt = f["fact_text"]
        # Strip the give-away year from the prompt where formulaic
        for token in (f" in {year}", f"/{year}"):
            prompt = prompt.replace(token, "")
        out.append(
            {
                "content_hash": content_hash("year_guess", f["content_hash"]),
                "qtype": "year_guess",
                "category": f["category"],
                "difficulty": f.get("_difficulty", 3),
                "prompt": prompt,
                "correct": str(year),
                "year": year,
                "image_url": f.get("image_url"),
                "source_url": f.get("source_url"),
            }
        )
    return out


def forge_higher_lower(facts: list[dict], rng: random.Random) -> list[dict]:
    by_unit: dict[str, list[dict]] = {}
    for f in facts:
        if f.get("numeric_value") and f.get("numeric_unit"):
            by_unit.setdefault(f["numeric_unit"], []).append(f)

    out = []
    for unit, rows in by_unit.items():
        rng.shuffle(rows)
        for a, b in zip(rows[::2], rows[1::2]):
            lo, hi = sorted((a["numeric_value"], b["numeric_value"]))
            if lo <= 0 or (hi - lo) / hi < MIN_HL_GAP_RATIO:
                continue  # too close — quality gate
            out.append(
                {
                    "content_hash": content_hash("higher_lower", a["content_hash"], b["content_hash"]),
                    "qtype": "higher_lower",
                    "category": a["category"],
                    "difficulty": max(a.get("_difficulty", 3), b.get("_difficulty", 3)),
                    "prompt": f"Which has more {unit}?",
                    "correct": "higher" if b["numeric_value"] > a["numeric_value"] else "lower",
                    "value_a": a["numeric_value"],
                    "value_b": b["numeric_value"],
                    "subject_a": a["subject"],
                    "subject_b": b["subject"],
                    "unit": unit,
                    "image_url": b.get("image_url") or a.get("image_url"),
                    "source_url": a.get("source_url"),
                }
            )
    return out


def forge_multiple_choice(facts: list[dict], rng: random.Random) -> list[dict]:
    """Facts tagged with meta.answer_field carry a (question, answer) pair;
    distractors are sibling answers from the same field + category."""
    pool: dict[tuple[str, str], list[dict]] = {}
    for f in facts:
        field = (f.get("meta") or {}).get("answer_field")
        if field and (f.get("meta") or {}).get("answer"):
            pool.setdefault((f["category"], field), []).append(f)

    out = []
    for (category, field), rows in pool.items():
        answers = list({r["meta"]["answer"] for r in rows})
        if len(answers) < 4:
            continue
        for f in rows:
            answer = f["meta"]["answer"]
            distractors = rng.sample([a for a in answers if a != answer], 3)
            prompt = f["fact_text"].replace(answer, "_____")
            if "_____" not in prompt:
                continue
            choices = distractors + [answer]
            rng.shuffle(choices)
            out.append(
                {
                    "content_hash": content_hash("multiple_choice", f["content_hash"]),
                    "qtype": "multiple_choice",
                    "category": category,
                    "difficulty": f.get("_difficulty", 3),
                    "prompt": prompt,
                    "correct": answer,
                    "choices": choices,
                    "image_url": f.get("image_url"),
                    "source_url": f.get("source_url"),
                }
            )
    return out


def forge_where(facts: list[dict]) -> list[dict]:
    """THE MAP: the fact text says WHAT the place is; the skill is pinning it.
    The text naming the answer is fine — coordinates are the hidden truth."""
    out = []
    for f in facts:
        if f.get("lat") is None or f.get("lng") is None:
            continue
        answer = (f.get("meta") or {}).get("answer") or f["subject"]
        out.append(
            {
                "content_hash": content_hash("where", f["content_hash"]),
                "qtype": "where",
                "category": f["category"],
                "difficulty": f.get("_difficulty", 3),
                "prompt": f"Pin it: {f['fact_text']}",
                "correct": answer,
                "lat": f["lat"],
                "lng": f["lng"],
                "image_url": f.get("image_url"),
                "source_url": f.get("source_url"),
            }
        )
    return out


def forge_clues(facts: list[dict]) -> list[dict]:
    """Jeopardy-style: the fact sentence becomes the clue, the subject the answer.
    Only facts whose text doesn't leak the subject verbatim qualify."""
    out = []
    for f in facts:
        subject = f["subject"]
        text = f["fact_text"]
        if subject.lower() in text.lower():
            clue = text.replace(subject, "this " + _subject_class(f))
            # crude leak check after substitution
            if subject.lower() in clue.lower():
                continue
        else:
            clue = text
        out.append(
            {
                "content_hash": content_hash("clue", f["content_hash"]),
                "qtype": "clue",
                "category": f["category"],
                "difficulty": f.get("_difficulty", 3),
                "prompt": clue,
                "correct": subject,
                "image_url": f.get("image_url"),
                "source_url": f.get("source_url"),
            }
        )
    return out


def forge_seance(facts: list[dict]) -> list[dict]:
    """THE SÉANCE: groups facts by (category, subject) and emits a multi-clue
    question. Clues are ordered vague→specific (numeric/generic first, answer_field
    last). Subject name is masked throughout. Requires ≥3 clean clues per subject.
    """
    by_subject: dict[tuple[str, str], list[dict]] = {}
    for f in facts:
        key = (f["category"], f["subject"])
        by_subject.setdefault(key, []).append(f)

    out = []
    for (category, subject), group in by_subject.items():
        if len(group) < MIN_SEANCE_CLUES:
            continue

        def _specificity(f: dict) -> int:
            # 0 = most vague (plain numeric), 1 = year, 2 = specific (answer_field)
            has_answer = bool((f.get("meta") or {}).get("answer_field"))
            if has_answer:
                return 2
            if f.get("year"):
                return 1
            return 0

        ordered = sorted(group, key=_specificity)

        clues: list[str] = []
        for f in ordered:
            text = f["fact_text"]
            if subject.lower() in text.lower():
                masked = text.replace(subject, "this " + _subject_class(f))
                if subject.lower() in masked.lower():
                    continue  # substitution didn't fully mask — skip
                clues.append(masked)
            else:
                clues.append(text)

        if len(clues) < MIN_SEANCE_CLUES:
            continue

        # Difficulty from the most popular fact in the group
        best = max(group, key=lambda f: f.get("popularity") or 0)
        img = next((f.get("image_url") for f in group if f.get("image_url")), None)
        src = next((f.get("source_url") for f in group if f.get("source_url")), None)

        out.append(
            {
                "content_hash": content_hash("seance", category, subject),
                "qtype": "seance",
                "category": category,
                "difficulty": best.get("_difficulty", 3),
                "prompt": "Who or what am I? Reveal clues one at a time.",
                "correct": subject,
                "clues": clues[:5],  # cap at 5 clues
                "image_url": img,
                "source_url": src,
            }
        )
    return out


def forge_ladder(facts: list[dict], rng: random.Random) -> list[dict]:
    """THE LADDER: emits a target subject + a candidate pool of numeric siblings.
    Each candidate carries {label, category, region, magnitude} so the client
    distance function can surface shared-attribute hints.
    """
    by_unit: dict[str, list[dict]] = {}
    for f in facts:
        if f.get("numeric_value") and f.get("numeric_unit"):
            by_unit.setdefault(f["numeric_unit"], []).append(f)

    def _mag(f: dict) -> float:
        return math.log10(max(1, f["numeric_value"]))

    def _region(f: dict) -> str | None:
        return (f.get("meta") or {}).get("region")

    def _dist(target: dict, candidate: dict) -> float:
        d = 0.0
        if target["category"] != candidate["category"]:
            d += 2.0
        tr, cr = _region(target), _region(candidate)
        if tr and cr and tr != cr:
            d += 1.0
        d += min(1.0, abs(_mag(target) - _mag(candidate)))
        return d

    out = []
    for unit, rows in by_unit.items():
        if len(rows) < LADDER_CANDIDATES + 1:
            continue
        rng.shuffle(rows)
        # Use first half as targets, build pools from the rest
        for target in rows[: len(rows) // 2]:
            others = [r for r in rows if r["subject"] != target["subject"]]
            if len(others) < LADDER_CANDIDATES:
                continue
            # Pick LADDER_CANDIDATES others, ensuring variety
            pool = rng.sample(others, min(LADDER_CANDIDATES + 2, len(others)))
            pool.sort(key=lambda c: _dist(target, c))
            pool = pool[:LADDER_CANDIDATES]

            correct = pool[0]["subject"]  # closest candidate is the right answer
            candidates = [
                {
                    "label": c["subject"],
                    "category": c["category"],
                    "region": _region(c),
                    "magnitude": round(_mag(c), 2),
                }
                for c in pool
            ]
            rng.shuffle(candidates)

            out.append(
                {
                    "content_hash": content_hash("ladder", target["content_hash"]),
                    "qtype": "ladder",
                    "category": target["category"],
                    "difficulty": target.get("_difficulty", 3),
                    "prompt": f"Which is closest to {target['subject']} by {unit}?",
                    "correct": correct,
                    "candidates": candidates,
                    "image_url": target.get("image_url"),
                    "source_url": target.get("source_url"),
                }
            )
    return out


def _subject_class(f: dict) -> str:
    return {
        "music": "artist",
        "sports": "player" if f["source"] == "sleeper" else "team",
        "screen": "title",
        "history": "subject",
        "geography": "place",
        "wildcard": "subject",
    }[f["category"]]


# ── daily board (deterministic, shared) ─────────────────────────────────────
def build_daily_board(questions: list[dict], for_date: date) -> dict | None:
    rng = random.Random(for_date.toordinal())  # same board for everyone, every day
    clues = [q for q in questions if q["qtype"] == "clue"]
    by_cat: dict[str, list[dict]] = {}
    for q in clues:
        by_cat.setdefault(q["category"], []).append(q)

    cats = [c for c, rows in by_cat.items() if len({q["difficulty"] for q in rows}) >= 3]
    if len(cats) < 5:
        return None
    cols = []
    for c in rng.sample(cats, 5):
        rows = by_cat[c]
        col = []
        for d in range(1, 6):
            tier = [q for q in rows if q["difficulty"] == d] or rows
            col.append(rng.choice(tier)["content_hash"])
        cols.append({"category": c, "cells": col})
    dd_col, dd_row = rng.randrange(5), rng.randrange(5)
    return {"set_date": for_date.isoformat(), "mode": "board",
            "payload": {"columns": cols, "daily_double": [dd_col, dd_row]}}


# ── fact loading ────────────────────────────────────────────────────────────
def load_facts_from_bronze() -> list[dict]:
    facts = []
    for path in sorted(Path(RAW_DIR).glob("*.jsonl")):
        for line in path.read_text().splitlines():
            row = json.loads(line)
            row.pop("_ingested_at", None)
            facts.append(row)
    # latest version per content_hash wins
    return list({f["content_hash"]: f for f in facts}.values())


def load_facts_from_db(conn) -> list[dict]:
    return fetch_all(conn, "select * from facts", limit=20000)


def forge_all(facts: list[dict], seed: int = 0) -> list[dict]:
    rng = random.Random(seed)
    assign_difficulty(facts)
    questions = (
        forge_year_guess(facts)
        + forge_higher_lower(facts, rng)
        + forge_multiple_choice(facts, rng)
        + forge_clues(facts)
        + forge_where(facts)
        + forge_seance(facts)
        + forge_ladder(facts, rng)
    )
    return questions


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-bronze", action="store_true", help="offline: forge from data/raw/*.jsonl")
    args = ap.parse_args()

    console.rule("[bold]Question forge")
    conn = None if args.from_bronze else get_db()
    facts = load_facts_from_bronze() if (args.from_bronze or conn is None) else load_facts_from_db(conn)
    console.print(f"loaded {len(facts)} facts")

    questions = forge_all(facts)
    by_type: dict[str, int] = {}
    for q in questions:
        by_type[q["qtype"]] = by_type.get(q["qtype"], 0) + 1
    console.print(f"forged {len(questions)} questions: {by_type}")

    n = upsert_questions(conn, questions)
    board = build_daily_board(questions, date.today())
    if conn is not None and board and upsert_daily_set(conn, board):
        console.print("[green]✓ daily board published[/green]")
    console.print(f"[green]✓ {n} questions upserted[/green]")


if __name__ == "__main__":
    main()
