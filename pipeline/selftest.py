"""
selftest.py — offline sanity checks (no network, no DB). Run in CI before anything else.

Checks:
1. forge recipes produce valid questions from synthetic facts
2. the committed seed bank parses and every question is renderable
3. daily board determinism (same date ⇒ same board)
4. bronze compaction dedupes and keeps stable timestamps (repo-as-database mode)
"""

from __future__ import annotations

import argparse
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
            image_url="https://cdn-images.dzcdn.net/images/artist/def/1000x1000-000.jpg",
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
            image_url="https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000.jpg",
        ))
        # §3.13 music depth: label / genre / featured-artist MC + BPM higher_lower
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Artist {i}",
            fact_text=f'Artist {i}\'s album "Album {i}" was released on the label Label {i}.',
            popularity=10.0 * i, source_url="https://example.com",
            meta={"answer_field": "label", "answer": f"Label {i}"},
        ))
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Artist {i}",
            fact_text=f'Artist {i}\'s album "Album {i}" is categorized as Genre {i}.',
            popularity=10.0 * i, source_url="https://example.com",
            meta={"answer_field": "genre", "answer": f"Genre {i}"},
        ))
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Artist {i}",
            fact_text=f'On the track "Song {i}", Artist {i} features Guest {i}.',
            popularity=10.0 * i, source_url="https://example.com",
            meta={"answer_field": "featured_artist", "answer": f"Guest {i}"},
        ))
        facts.append(make_fact(
            source="deezer", category="music", subject=f"Track {i}",
            fact_text=f'"Track {i}" by Artist {i} has a tempo of {80 + i * 50} BPM.',
            numeric_value=float(80 + i * 50), numeric_unit="BPM",
            popularity=10.0 * i, source_url="https://example.com",
        ))

    # THE THREAD (2.8): a set of geography subjects that (a) share a board theme
    # via a keyword in the prose ('voyage') and (b) chain by last-letter→first-
    # letter (Oceanus→Seafarer→Rudder→Reef→Frigate→Estuary), so forge_thread can
    # build a clean themed chain offline.
    # source must NOT be the broad 'wikipedia' sweep — forge_thread's notability
    # gate bars that source from chains (obscure stubs make unguessable themes).
    chain_subjects = ["Oceanus", "Seafarer", "Rudder", "Reef", "Frigate", "Estuary"]
    for j, subj in enumerate(chain_subjects):
        facts.append(make_fact(
            source="curated", category="geography", subject=subj,
            fact_text=f"A landmark from the great voyage, known to every sailor who set sail.",
            popularity=20.0 + j, source_url="https://example.com",
        ))

    # Ready-made MC trivia (trivia_ingest: opentdb/QuizAPI) → forge_trivia keeps
    # the source's own distractors.
    facts.append(make_fact(
        source="opentdb", category="screen", subject="Inception",
        fact_text="Which 2010 Christopher Nolan film unfolds as a dream within a dream?",
        popularity=55.0, source_url="https://opentdb.com",
        meta={"trivia_q": True, "choices": ["Inception", "Tenet", "Interstellar", "Memento"]},
    ))
    return facts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--core-only", action="store_true",
        help=(
            "skip checks against the currently-committed seed bank (size/category-"
            "spread). Use this as a pre-ingestion gate: it tests the pipeline code "
            "itself with synthetic facts, not a downstream artifact that a previous "
            "CI run may have left in a bad state — gating ingestion on the latter "
            "creates a deadlock where a thin/regressed bank blocks the very run "
            "that would refresh it."
        ),
    )
    args = ap.parse_args()

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
    check("forge produces thread", "thread" in types)

    mc_corrects = {q["correct"] for q in qs if q["qtype"] == "multiple_choice"}
    check("forge produces music label MC", any(c.startswith("Label ") for c in mc_corrects))
    check("forge produces music genre MC", any(c.startswith("Genre ") for c in mc_corrects))
    check("forge produces music featured-artist MC", any(c.startswith("Guest ") for c in mc_corrects))
    check("forge produces music BPM higher_lower",
          any(q["qtype"] == "higher_lower" and q.get("unit") == "BPM" for q in qs))
    music_qs = [q for q in qs if q.get("category") == "music"]
    check("forge strips album-cover art from music questions (leak)",
          all("/images/cover/" not in (q.get("image_url") or "") for q in music_qs))
    check("forge preserves music artist portraits (not over-stripped)",
          any("/images/artist/" in (q.get("image_url") or "") for q in music_qs))

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

    # §3.15 wikidata source: row→facts contract + forge-roundtrip, run offline so
    # the keyless WDQS ingest is covered by the same pre-ingestion gate.
    try:
        from wikidata_ingest import _selfcheck as _wd_selfcheck
        _wd_selfcheck()
        check("wikidata_ingest row→facts + forge roundtrip", True)
    except Exception as e:
        check("wikidata_ingest row→facts + forge roundtrip", False, repr(e))

    for q in qs:
        if q["qtype"] == "higher_lower":
            gap_ok = q["value_a"] != q["value_b"]
            check("HL pair has distinct values", gap_ok)
            break

    for q in qs:
        if q["qtype"] == "clue":
            check("clue does not leak the answer", q["correct"].lower() not in q["prompt"].lower())
            # THE BOARD (2.3): every clue carries board theme tags incl. the
            # 'library' fallback, so the board can group/select by daily theme.
            themes = (q.get("meta") or {}).get("board_themes") or []
            check("clue carries board theme tags", isinstance(themes, list) and "library" in themes,
                  f"{themes}")
            break

    # 2.21 board distractors: clues get same-category multiple-choice options so
    # the board's easy mode doesn't synthesize cross-category giveaways.
    clue_choices = [q for q in qs if q["qtype"] == "clue" and q.get("choices")]
    check("clues carry same-category choices", len(clue_choices) > 0,
          f"{len(clue_choices)} clues with choices")
    if clue_choices:
        cc = clue_choices[0]
        check("clue choices include the answer, 4 options",
              cc["correct"] in cc["choices"] and len(cc["choices"]) == 4)

    # forge_trivia keeps the source's hand-authored distractors verbatim.
    trivia_mc = [q for q in qs if q["qtype"] == "multiple_choice" and q["correct"] == "Inception"]
    check("forge_trivia emits MC keeping source distractors",
          bool(trivia_mc) and set(trivia_mc[0]["choices"]) ==
          {"Inception", "Tenet", "Interstellar", "Memento"})

    # ── §3.12 distractor closeness ───────────────────────────────────────────
    # Distractors must sit *close* to the answer (same era/magnitude/shape) so the
    # right option isn't guessable by being the odd one out. The closeness
    # heuristic lives in distractor_quality; assert it (a) catches obvious
    # outliers, (b) repairs a mixed pool, and (c) the forge emits no separable set.
    import random as _random

    from distractor_quality import closest as _closest
    from distractor_quality import separable_reason
    check("gate flags a type outlier (year among names)",
          separable_reason(["Paris", "London", "Berlin", "1999"], "1999") is not None)
    check("gate flags a magnitude outlier (7-fig among single digits)",
          separable_reason(["1500000", "12", "9", "11"], "1500000") is not None)
    check("gate passes a tight same-magnitude set",
          separable_reason(["1500000", "1200000", "900000", "1100000"], "1500000") is None)
    _d = _closest("1500000", ["1200000", "900000", "1100000", "5", "12", "9"], 3, _random.Random(1))
    check("closest repairs a mixed-magnitude pool",
          _d is not None and separable_reason([*_d, "1500000"], "1500000") is None, f"{_d}")
    # every distractor set the forge SYNTHESISES (clue + meta-answer MC; not the
    # hand-authored trivia set) must be non-separable.
    synth = [q for q in qs
             if q["qtype"] in ("multiple_choice", "clue")
             and isinstance(q.get("choices"), list) and len(q["choices"]) == 4
             and q["correct"] != "Inception"]
    sep = [(q["correct"], separable_reason(q["choices"], q["correct"])) for q in synth]
    sep = [s for s in sep if s[1]]
    check("forge synthesises no trivially-separable distractor sets",
          not sep, f"{len(sep)}/{len(synth)} separable e.g. {sep[:2]}")

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

    for q in qs:
        if q["qtype"] == "thread":
            chain = q.get("chain") or []
            check("thread has ≥5 links", len(chain) >= 5, f"{len(chain)} found")
            check("thread links carry prompt/answer/link",
                  all(all(k in lk for k in ("prompt", "answer", "link")) for lk in chain))
            # last-letter→first-letter adjacency holds across the whole chain
            import re as _re
            keys = [_re.sub(r"[^a-z]", "", lk["answer"].lower()) for lk in chain]
            adj_ok = all(keys[i][-1] == keys[i + 1][0] for i in range(len(keys) - 1))
            check("thread chain is last-letter→first-letter adjacent", adj_ok)
            theme = q.get("theme") or ""
            check("thread has a master theme", bool(theme) and q["correct"] == theme)
            # no link prompt may leak the theme name
            check("thread links don't leak the theme",
                  all(theme.lower() not in lk["prompt"].lower() for lk in chain))
            choices = q.get("theme_choices") or []
            check("thread final choices include the theme",
                  theme in choices and len(choices) >= 2)
            break
    else:
        check("forge produces thread", False, "no thread question in output")

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

    # ── bronze→staging source contract (§3.11) ───────────────────────────────
    # The dbt accepted_values test on stg_facts.source is a hand-kept allow-list
    # that gates the whole publish. When a new ingest writes a source the list
    # doesn't know, the nightly dies at the dbt step — and Séance/Ladder, which
    # are server-generated with no seed fallback, go dark. Catch that drift here,
    # offline and before commit, against the same allow-list dbt enforces.
    import yaml

    from common import RAW_DIR
    schema = yaml.safe_load(
        (REPO_ROOT / "transform" / "models" / "staging" / "schema.yml").read_text()
    )
    accepted: set[str] = set()
    for m in schema["models"]:
        for col in m.get("columns", []) if m["name"] == "stg_facts" else []:
            if col["name"] != "source":
                continue
            for t in col.get("tests", []):
                if isinstance(t, dict) and "accepted_values" in t:
                    accepted = {str(v).lower() for v in t["accepted_values"]["values"]}
    bronze_sources: set[str] = set()
    for f in RAW_DIR.glob("*.jsonl"):
        for line in f.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            s = json.loads(line).get("source")
            if s is not None:
                bronze_sources.add(str(s).lower())
    unknown = bronze_sources - accepted
    check("bronze sources all in dbt accepted_values (else transform gates publish)",
          not unknown, f"unlisted sources: {sorted(unknown)}")

    # ── per-source health floor (§3.17, debt #3) ─────────────────────────────
    # The total floor (question_forge --min-questions) is cleared by one healthy
    # source, so a single ingest can die and the bank rots silently. Hold every
    # live (source, category) bucket in bronze to a minimum instead, so the next
    # starvation fails the run loudly and names the culprit.
    from common import HEALTH_FLOOR, bronze_bucket_counts, starved_buckets
    # END STATE: a starved source trips the floor (pure-helper unit check).
    check("health floor flags a starved source",
          starved_buckets({("deezer", "music"): 200, ("zombie", "history"): 2})
          == [("zombie", "history")])
    check("health floor passes a healthy roster",
          starved_buckets({("deezer", "music"): 200, ("wikipedia", "history"): 468}) == [])
    # Live gate: hold the committed bronze itself to the floor.
    starved = starved_buckets(bronze_bucket_counts())
    check(f"every live (source,category) bronze bucket has ≥{HEALTH_FLOOR} facts",
          not starved, f"starved: {starved}")

    if args.core_only:
        if FAILURES:
            print(f"\n{len(FAILURES)} failure(s)")
            sys.exit(1)
        print("\nall good (core checks only — seed bank not checked)")
        return

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
            if q["qtype"] == "thread":
                chain = q.get("chain") or []
                ok = ok and isinstance(chain, list) and len(chain) >= 5
                ok = ok and all(all(k in lk for k in ("prompt", "answer", "link")) for lk in chain)
                ok = ok and q.get("theme") == q["correct"]
            if not ok:
                check("seed bank question shape", False, json.dumps(q)[:120])
                break
        else:
            check("seed bank question shapes all valid", True)

        # ── offline playability gates (Clock 2.4 / Thread 2.8) ────────────────
        # THE CLOCK needs dated facts offline; the broad scrapers produce none
        # (year is null), so the curated baseline must keep year_guess fuel here.
        yg = [q for q in bank if q["qtype"] == "year_guess"]
        check("seed bank has year_guess fuel for THE CLOCK", len(yg) >= 6, f"{len(yg)} found")
        check("year_guess prompts don't leak the year",
              all(str(q.get("year")) not in q["prompt"] for q in yg))
        music_bank = [q for q in bank if q.get("category") == "music"]
        check("seed bank: no music image leaks the answer (no album covers)",
              all("/images/cover/" not in (q.get("image_url") or "") for q in music_bank))
        # THE CLOCK's audio rounds must play offline: melody facts (no audio files)
        # carry a synthesizable note list + a year to guess.
        au = [q for q in bank if q["qtype"] == "audio_guess"]
        check("seed bank has offline audio rounds for THE CLOCK", len(au) >= 3, f"{len(au)} found")
        check("audio rounds carry an offline melody + year",
              all(isinstance(q.get("melody"), list) and q["melody"] and isinstance(q.get("year"), int) for q in au))
        # THE THREAD's master theme must be deducible, not handed over: no chain
        # answer may equal the theme it belongs to.
        for q in (q for q in bank if q["qtype"] == "thread"):
            theme = (q.get("theme") or "").lower()
            answers = [lk["answer"].lower() for lk in (q.get("chain") or [])]
            check("thread answers don't leak the theme", theme and theme not in answers,
                  f"{q.get('theme')} ∈ {[lk['answer'] for lk in q.get('chain') or []]}")

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

        # ── §3.12 distractor closeness (regression tripwire) ──────────────────
        # Across the whole bank, trivially-separable MC/clue sets must stay rare.
        # The forge synthesises zero (asserted above on live output); the residual
        # here is third-party trivia whose hand-authored answer happens to read as
        # a number/year ("2002" the song, "+44" the band) — not a synthesis fault.
        # A spike means our distractor logic regressed.
        from distractor_quality import separable_reason as _sep
        mc = [q for q in bank if q["qtype"] in ("multiple_choice", "clue")
              and isinstance(q.get("choices"), list) and len(q["choices"]) == 4]
        seps = [q for q in mc if _sep(q["choices"], q["correct"])]
        share = len(seps) / len(mc) if mc else 0.0
        check("seed-bank trivially-separable distractor share ≤ 3%",
              share <= 0.03, f"{len(seps)}/{len(mc)} ({share:.1%})")
    else:
        check("seed bank exists", False, str(seed_path))

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s)")
        sys.exit(1)
    print("\nall good")


if __name__ == "__main__":
    main()
