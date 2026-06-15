"""
selftest.py — offline sanity checks (no network, no DB). Run in CI before anything else.

Checks:
1. forge recipes produce valid questions from synthetic facts
2. the committed seed bank parses and every question is renderable
3. daily board determinism (same date ⇒ same board)
4. bronze compaction dedupes and keeps stable timestamps (repo-as-database mode)
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
        facts.append(make_fact(
            source="restcountries", category="geography", subject=f"Country {i}",
            fact_text=f"Capital {i} is the capital of Country {i}.",
            lat=float(-60 + i * 15), lng=float(-150 + i * 35),
            popularity=9.0 * i, source_url="https://example.com",
            meta={"answer_field": "capital", "answer": f"Capital {i}"},
        ))
        # Numeric geo facts (needed for seance grouping and ladder)
        facts.append(make_fact(
            source="restcountries", category="geography", subject=f"Country {i}",
            fact_text=f"Country {i} has a population of {(i + 1) * 10_000_000:,}.",
            numeric_value=float((i + 1) * 10_000_000), numeric_unit="population",
            popularity=9.0 * i, source_url="https://example.com",
            meta={"region": f"Region {i % 3}"},
        ))
        facts.append(make_fact(
            source="restcountries", category="geography", subject=f"Country {i}",
            fact_text=f"Country {i} covers {(i + 1) * 50_000:,} km².",
            numeric_value=float((i + 1) * 50_000), numeric_unit="area (km²)",
            popularity=9.0 * i, source_url="https://example.com",
            meta={"region": f"Region {i % 3}"},
        ))
        # Music album year for seance grouping
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Artist {i}",
            fact_text=f'Artist {i} released the album "Album {i}" in {1990 + i * 3}.',
            year=1990 + i * 3,
            numeric_value=float(i + 1), numeric_unit="Deezer albums",
            popularity=10.0 * i, source_url="https://example.com",
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
    check("forge produces where", "where" in types)
    check("forge produces seance", "seance" in types)
    check("forge produces ladder", "ladder" in types)

    for q in qs:
        if q["qtype"] == "where":
            check("where carries coordinates",
                  -90 <= q["lat"] <= 90 and -180 <= q["lng"] <= 180)
            break

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

    for q in qs:
        if q["qtype"] == "seance":
            clues = q.get("clues") or []
            check("seance has ≥3 clues", len(clues) >= 3, f"{len(clues)} found")
            check("seance clues are strings", all(isinstance(c, str) for c in clues))
            check("seance clues don't leak answer",
                  all(q["correct"].lower() not in c.lower() for c in clues))
            break
    else:
        check("forge produces seance", False, "no seance question in output")

    for q in qs:
        if q["qtype"] == "ladder":
            cands = q.get("candidates") or []
            check("ladder has ≥3 candidates", len(cands) >= 3, f"{len(cands)} found")
            check("ladder candidates have required fields",
                  all("label" in c and "magnitude" in c for c in cands))
            check("ladder correct is a candidate label",
                  any(c["label"] == q["correct"] for c in cands))
            break
    else:
        check("forge produces ladder", False, "no ladder question in output")

    d = date(2026, 6, 12)
    b1, b2 = build_daily_board(qs, d), build_daily_board(qs, d)
    check("daily board is deterministic", b1 == b2)

    # bronze compaction (DB-less serving depends on this not bloating the repo)
    import tempfile

    from common import compact_jsonl

    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "test.jsonl"
        p.write_text(
            '{"_ingested_at": "t1", "content_hash": "a", "fact_text": "same"}\n'
            '{"_ingested_at": "t2", "content_hash": "a", "fact_text": "same"}\n'
            '{"_ingested_at": "t3", "content_hash": "b", "fact_text": "other"}\n'
        )
        n = compact_jsonl(p)
        lines = [json.loads(l) for l in p.read_text().splitlines()]
        check("bronze compaction dedupes by content_hash", n == 2 and len(lines) == 2)
        row_a = next(r for r in lines if r["content_hash"] == "a")
        check("compaction keeps original timestamp for unchanged facts",
              row_a["_ingested_at"] == "t1")

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
            if q["qtype"] == "where":
                ok = ok and -90 <= q.get("lat", 999) <= 90 and -180 <= q.get("lng", 999) <= 180
            if q["qtype"] == "seance":
                ok = ok and isinstance(q.get("clues"), list) and len(q["clues"]) >= 3
            if q["qtype"] == "ladder":
                ok = ok and isinstance(q.get("candidates"), list) and len(q["candidates"]) >= 3
                ok = ok and any(c.get("label") == q["correct"] for c in (q.get("candidates") or []))
            if not ok:
                check("seed bank question shape", False, json.dumps(q)[:120])
                break
        else:
            check("seed bank question shapes all valid", True)

        # ── difficulty calibration gate ──────────────────────────────────────
        # New/sourced questions must spread across tiers, not pile onto one
        # difficulty — otherwise THE BOARD (needs ≥3 tiers/category) can't build
        # and "hard mode" silently degrades into a wall of 5s.
        clues = [q for q in bank if q["qtype"] == "clue"]
        tiers = {q.get("difficulty") for q in clues}
        check("clue difficulties span ≥3 tiers", len(tiers) >= 3, f"tiers {sorted(tiers)}")
        if clues:
            from collections import Counter
            hist = Counter(q.get("difficulty") for q in clues)
            top_share = max(hist.values()) / len(clues)
            check("no clue difficulty tier exceeds 70%",
                  top_share <= 0.70, f"max share {top_share:.0%} {dict(sorted(hist.items()))}")
        cats_with_board_spread = sum(
            1 for c in {q["category"] for q in clues}
            if len({q["difficulty"] for q in clues if q["category"] == c}) >= 3
        )
        check("≥3 categories have a board-ready difficulty spread",
              cats_with_board_spread >= 3, f"{cats_with_board_spread} categories")
    else:
        check("seed bank exists", False, str(seed_path))

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s)")
        sys.exit(1)
    print("\nall good")


if __name__ == "__main__":
    main()
