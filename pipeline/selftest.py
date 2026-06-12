"""
selftest.py — offline sanity checks (no network, no DB). Run in CI before anything else.

Checks:
1. forge recipes produce valid questions from synthetic facts
2. the committed seed bank parses and every question is renderable
3. daily board determinism (same date ⇒ same board)
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

from common import REPO_ROOT, make_fact
from question_forge import build_daily_board, forge_all

FAILURES: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'✓' if ok else '✗'} {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        FAILURES.append(name)


def synthetic_facts() -> list[dict]:
    facts = []
    for i in range(8):
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Artist {i}",
            fact_text=f"Artist {i} has {(i + 1) * 1_000_000:,} fans on Deezer.",
            numeric_value=(i + 1) * 1_000_000.0, numeric_unit="Deezer fans",
            popularity=10.0 * i, source_url="https://example.com",
        ))
        facts.append(make_fact(
            source="wikipedia", category="history", subject=f"Event {i}",
            fact_text=f"On 06/12/{1900 + i * 10}: something notable happened involving Event {i}.",
            year=1900 + i * 10, popularity=12.0 * i, source_url="https://example.com",
        ))
        facts.append(make_fact(
            source="sleeper", category="sports", subject=f"Player {i}",
            fact_text=f"Player {i} played college football at College {i}.",
            popularity=8.0 * i, source_url="https://example.com",
            meta={"answer_field": "college", "answer": f"College {i}"},
        ))
    return facts


def main() -> None:
    facts = synthetic_facts()
    qs = forge_all(facts)
    types = {q["qtype"] for q in qs}

    check("forge produces year_guess", "year_guess" in types)
    check("forge produces higher_lower", "higher_lower" in types)
    check("forge produces multiple_choice", "multiple_choice" in types)
    check("forge produces clue", "clue" in types)

    for q in qs:
        if q["qtype"] == "multiple_choice":
            check("MC includes correct in 4 choices",
                  len(q["choices"]) == 4 and q["correct"] in q["choices"])
            check("MC prompt blanks the answer", "_____" in q["prompt"] and q["correct"] not in q["prompt"])
            break
    for q in qs:
        if q["qtype"] == "higher_lower":
            gap_ok = q["value_a"] != q["value_b"]
            check("HL pair has distinct values", gap_ok)
            break
    for q in qs:
        if q["qtype"] == "clue":
            check("clue does not leak the answer", q["correct"].lower() not in q["prompt"].lower())
            break

    d = date(2026, 6, 12)
    b1, b2 = build_daily_board(qs, d), build_daily_board(qs, d)
    check("daily board is deterministic", b1 == b2)

    seed_path = REPO_ROOT / "frontend" / "public" / "seed-questions.json"
    if seed_path.exists():
        bank = json.loads(seed_path.read_text())["questions"]
        check("seed bank has ≥40 questions", len(bank) >= 40, f"{len(bank)} found")
        for q in bank:
            ok = all(k in q for k in ("qtype", "category", "difficulty", "prompt", "correct"))
            if q["qtype"] == "multiple_choice":
                ok = ok and isinstance(q.get("choices"), list) and q["correct"] in q["choices"]
            if q["qtype"] == "year_guess":
                ok = ok and isinstance(q.get("year"), int)
            if q["qtype"] == "higher_lower":
                ok = ok and all(q.get(k) is not None for k in ("value_a", "value_b", "subject_a", "subject_b", "unit"))
            if not ok:
                check("seed bank question shape", False, json.dumps(q)[:120])
                break
        else:
            check("seed bank question shapes all valid", True)
    else:
        check("seed bank exists", False, str(seed_path))

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s)")
        sys.exit(1)
    print("\nall good")


if __name__ == "__main__":
    main()
