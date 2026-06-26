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
import re
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
from distractor_quality import closest
from quality_score import quality_score

MIN_HL_GAP_RATIO = 0.25  # higher/lower pairs must differ by ≥25% — never a coin flip
MIN_SEANCE_CLUES = 3     # minimum facts per subject to forge a séance question
LADDER_CANDIDATES = 6    # candidate pool size per ladder question

# THE BOARD (2.3) daily themes. The forge tags each clue with a theme keyword so
# the board can group/select by theme; the frontend picks the day's theme
# deterministically by date (frontend/lib/themes.ts). Keyword → matching tokens
# scanned (case-insensitive) in the clue text / subject. "library" is the
# always-eligible fallback (every clue suits a library).
BOARD_THEME_KEYWORDS: dict[str, tuple[str, ...]] = {
    "egypt": ("egypt", "nile", "pharaoh", "pyramid", "cairo", "sphinx"),
    "noir": ("noir", "detective", "murder", "crime", "shadow", "midnight"),
    "voyage": ("sea", "ship", "ocean", "island", "voyage", "sail", "port", "coast"),
    "cosmos": ("space", "star", "planet", "galaxy", "moon", "comet", "orbit"),
    "carnival": ("circus", "carnival", "festival", "parade", "fair"),
    "deep-sea": ("deep", "trench", "abyss", "submarine", "reef", "whale"),
    "library": (),  # fallback — always matches
}


def tag_board_themes(text: str, subject: str) -> list[str]:
    """Theme keywords a clue is eligible for (always includes the 'library'
    fallback). Lets THE BOARD group clues by the day's theme; non-matching days
    fall back to standard categories on the frontend."""
    hay = f"{text} {subject}".lower()
    tags = [k for k, toks in BOARD_THEME_KEYWORDS.items() if toks and any(t in hay for t in toks)]
    tags.append("library")
    return tags


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
def forge_audio(facts: list[dict]) -> list[dict]:
    """THE CLOCK audio rounds (folded Jukebox): a fact carrying an offline melody
    in meta becomes a "when was this first heard?" round — the year is the answer,
    the synthesized tune (lib/sound.ts) is the clue. No audio files involved."""
    out = []
    for f in facts:
        melody = (f.get("meta") or {}).get("melody")
        year = f.get("year")
        if not melody or not year:
            continue
        out.append(
            {
                "content_hash": content_hash("audio_guess", f["content_hash"]),
                "qtype": "audio_guess",
                "category": f["category"],
                "difficulty": f.get("_difficulty", 3),
                "prompt": f["fact_text"],
                "correct": str(year),
                "year": year,
                "melody": melody,
                "source_url": f.get("source_url"),
            }
        )
    return out


def forge_year_guess(facts: list[dict]) -> list[dict]:
    out = []
    for f in facts:
        year = f.get("year")
        if not year or year < 1800:
            continue
        if (f.get("meta") or {}).get("melody"):
            continue  # melody facts are audio rounds (forge_audio), not dial rounds
        prompt = f["fact_text"]
        # Redact the answer year wherever it appears so the prompt never hands it
        # over. On-this-day facts lead with the year ("1969 – …"); the old
        # formulaic strip (" in 1969", "/1969") missed those, leaking the answer.
        prompt = re.sub(rf"\b{year}\b", "____", prompt).strip(" –-—:•")
        if "____" not in prompt and str(year) in prompt:
            continue  # year embedded in a larger token we can't cleanly redact
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
            # §3.12: sample distractors *close* to the answer (same era/magnitude/
            # shape), not just any sibling, so the right option doesn't stand out.
            distractors = closest(answer, [a for a in answers if a != answer], 3, rng)
            if distractors is None:
                continue
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


def forge_trivia(facts: list[dict], rng: random.Random) -> list[dict]:
    """Ready-made MC trivia (opentdb, QuizAPI via trivia_ingest): the source
    already shipped a correct answer + its own incorrect answers. Keep those
    distractors (they're hand-authored, better than synthesised siblings) and
    emit a multiple_choice. Facts are tagged meta.trivia_q with meta.choices."""
    out = []
    for f in facts:
        meta = f.get("meta") or {}
        if not meta.get("trivia_q"):
            continue
        choices = [c for c in dict.fromkeys(meta.get("choices") or []) if c]
        prompt = f.get("fact_text") or ""
        answer = f["subject"]
        if len(choices) < 3 or answer not in choices or not prompt:
            continue
        shuffled = list(choices)
        rng.shuffle(shuffled)
        out.append(
            {
                "content_hash": content_hash("multiple_choice", f["content_hash"]),
                "qtype": "multiple_choice",
                "category": f["category"],
                "difficulty": f.get("_difficulty", 3),
                "prompt": prompt,
                "correct": answer,
                "choices": shuffled,
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


def _clue_distractors(
    subject: str, category: str, pool: dict[str, list[str]], rng: random.Random
) -> list[str] | None:
    """3 plausible wrong answers for a clue: other subjects from the SAME category,
    deduped and excluding anything that collapses onto the answer. Same-category
    keeps them similar in kind (a constellation sits next to constellations, not a
    rapper) — the old board built choices from every category, so the right answer
    stuck out. §3.12 tightens it further via `closest`: a year draws nearby years,
    a number draws the same order of magnitude, a name draws like-shaped names —
    so no option is the trivially separable odd-one-out. Returns None when the
    category can't field 3 distinct alternatives; the board then falls back to its
    client-side picker."""
    distractors = closest(subject, pool.get(category, []), 3, rng)
    if distractors is None:
        return None
    choices = [*distractors, subject]
    rng.shuffle(choices)
    return choices


def forge_clues(facts: list[dict], rng: random.Random | None = None) -> list[dict]:
    """Jeopardy-style: the fact sentence becomes the clue, the subject the answer.
    Only facts whose text doesn't leak the subject verbatim qualify."""
    rng = rng or random.Random(0)
    # per-category subject pool for same-category multiple-choice distractors
    subjects_by_cat: dict[str, list[str]] = {}
    for f in facts:
        subjects_by_cat.setdefault(f["category"], []).append(f["subject"])

    out = []
    for f in facts:
        if (f.get("meta") or {}).get("melody"):
            continue  # melody facts are audio-only (forge_audio); skip as clues
        subject = f["subject"]
        clue = mask_subject(f["fact_text"], subject, f)
        if clue is None:
            continue
        choices = _clue_distractors(subject, f["category"], subjects_by_cat, rng)
        out.append(
            {
                "content_hash": content_hash("clue", f["content_hash"]),
                "qtype": "clue",
                "category": f["category"],
                "difficulty": f.get("_difficulty", 3),
                "prompt": clue,
                "correct": subject,
                # same-category MC options for THE BOARD's easy mode; None ⇒ the
                # board synthesizes its own. Dropped for free-text (hard) mode.
                "choices": choices,
                "image_url": f.get("image_url"),
                "source_url": f.get("source_url"),
                # carried for THE THREAD's notability gate; ignored by the DB
                # upsert (not a question column) and dropped from the seed export.
                "source": f.get("source"),
                # THE BOARD theme tags (meta-only; not a stored column — the
                # frontend derives the day's theme, this just lets a DB consumer
                # group by it). See BOARD_THEME_KEYWORDS / lib/themes.ts.
                "meta": {"board_themes": tag_board_themes(clue, subject)},
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
            masked = mask_subject(f["fact_text"], subject, f)
            if masked is None:
                continue  # couldn't fully mask the subject — skip
            clues.append(masked)

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


MIN_THREAD_LINKS = 5     # shortest publishable chain for THE THREAD
MAX_THREAD_LINKS = 7

# Display names for the master theme a thread weaves toward (mirrors
# BOARD_THEME_KEYWORDS keys; 'library' is the always-true fallback and is NOT a
# recognizable master theme, so it's never used as a thread theme).
THREAD_THEME_NAMES: dict[str, str] = {
    "egypt": "Egypt",
    "noir": "Film Noir",
    "voyage": "The Voyage",
    "cosmos": "The Cosmos",
    "carnival": "The Carnival",
    "deep-sea": "The Deep Sea",
}


def _chain_key(answer: str) -> str:
    """Normalize an answer to its bare letters (for last-char→first-char joins)."""
    return re.sub(r"[^a-z]", "", answer.lower())


def forge_thread(clues: list[dict], rng: random.Random) -> list[dict]:
    """THE THREAD: greedy walk over masked CLUE questions sharing a board theme,
    chaining answer[n]'s last letter → answer[n+1]'s first letter. Every link ties
    (even tangentially) to one recognizable master theme; the final question asks
    for that theme. Offline-safe: derived from the same masked clues the board uses.

    # ponytail: a plain greedy walk from one seed — not a max-length Hamiltonian
    #   path over the theme graph. Good enough for a daily 5–7 link chain; if a
    #   theme can't reach MIN_THREAD_LINKS it's skipped rather than padded.
    """
    by_theme: dict[str, list[dict]] = {}
    for q in clues:
        # Notability gate: chains must read as recognizable, so the broad
        # random-article Wikipedia sweep (obscure SSSIs, minor houses) is barred
        # from threads — only structured/curated sources seed a chain a player
        # can actually name.
        # ponytail: source allowlist by exclusion; if the wikipedia ingest ever
        #   pulls notable articles, swap this for a per-fact notability flag.
        if q.get("source") == "wikipedia":
            continue
        for t in (q.get("meta") or {}).get("board_themes", []):
            if t not in THREAD_THEME_NAMES:  # skip 'library' — not a master theme
                continue
            # never let an answer give away the theme (e.g. "Egypt" in the Egypt thread)
            if THREAD_THEME_NAMES[t].lower() in q["correct"].lower():
                continue
            by_theme.setdefault(t, []).append(q)

    out = []
    for theme, pool in by_theme.items():
        # dedupe by answer spelling so a chain never repeats a word
        seen: set[str] = set()
        items: list[dict] = []
        for q in pool:
            key = _chain_key(q["correct"])
            if not key or key in seen:
                continue
            seen.add(key)
            items.append(q)
        if len(items) < MIN_THREAD_LINKS:
            continue
        rng.shuffle(items)

        chain: list[dict] = []
        for start in items:
            walk = [start]
            used = {_chain_key(start["correct"])}
            while len(walk) < MAX_THREAD_LINKS:
                last = _chain_key(walk[-1]["correct"])[-1]
                nxt = next(
                    (q for q in items
                     if _chain_key(q["correct"])[0] == last
                     and _chain_key(q["correct"]) not in used),
                    None,
                )
                if nxt is None:
                    break
                walk.append(nxt)
                used.add(_chain_key(nxt["correct"]))
            if len(walk) >= MIN_THREAD_LINKS:
                chain = walk
                break
        if not chain:
            continue

        theme_name = THREAD_THEME_NAMES[theme]
        links = []
        for i, q in enumerate(chain):
            nxt_letter = (
                _chain_key(chain[i + 1]["correct"])[0].upper()
                if i + 1 < len(chain) else None
            )
            link = f"Ties to {theme_name}."
            if nxt_letter:
                link += f" Its last letter passes the thread to “{nxt_letter}…”."
            else:
                link += " The final stitch — now name the thread."
            links.append({"prompt": q["prompt"], "answer": q["correct"], "link": link})

        # final-guess choices: the real theme + sibling theme names as distractors
        others = [n for k, n in THREAD_THEME_NAMES.items() if k != theme]
        choices = rng.sample(others, min(3, len(others))) + [theme_name]
        rng.shuffle(choices)

        src = next((q.get("source_url") for q in chain if q.get("source_url")), None)
        out.append(
            {
                "content_hash": content_hash("thread", theme, *[q["content_hash"] for q in chain]),
                "qtype": "thread",
                "category": chain[0]["category"],
                "difficulty": max(q.get("difficulty", 3) for q in chain),
                "prompt": "What is the thread that ties them all together?",
                "correct": theme_name,
                "chain": links,
                "theme": theme_name,
                "theme_choices": choices,
                "source_url": src,
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


# Generic type/descriptor nouns: kept in a name for natural-reading replacement
# runs ("the Sylvanus Thayer House" → "this subject"), but never themselves
# treated as a leak (so a stray standalone "station" elsewhere in the text isn't
# blanked out) and never a single-word match target.
_GENERIC_TYPE_WORDS = {
    "station", "line", "system", "house", "park", "building", "museum",
    "monument", "airport", "district", "village", "municipality", "diocese",
    "club", "team", "band", "song", "film", "movie", "book", "novel",
    "county", "square", "street", "road", "avenue", "bridge", "lighthouse",
    "church", "school", "college", "university", "hospital", "stadium",
    "channel", "metro", "tram", "trolleybus", "trolleybuses", "plass",
    "railway", "thoroughfare", "region", "voivodeship", "town", "city",
    "state", "province", "organisation", "organization", "award", "medal",
}
_STOPWORDS = {
    "the", "a", "an", "of", "in", "at", "on", "and", "or", "for", "to",
    "is", "are", "was", "were", "de", "la", "van", "der", "von", "da",
    "do", "das", "des", "el", "los", "las", "also",
}


def _name_words(subject: str) -> list[str]:
    """Subject words after stripping a trailing parenthetical/comma disambiguator
    ("X (Y)" / "X, Y"), in original order — the phrase a fact's prose is most
    likely to actually use when naming the subject."""
    core = re.sub(r"\s*\([^)]*\)\s*$", "", subject).strip()
    core = re.sub(r",\s*[^,]+$", "", core).strip()
    return re.findall(r"[^\d\W]+", core)


def mask_subject(text: str, subject: str, fact: dict) -> str | None:
    """Scrub every mention of `subject`'s identifying name from `text`.

    A plain `text.replace(subject, ...)` (the old approach) only catches the
    rare case where the fact's prose repeats the subject string verbatim. Wiki
    lead sentences routinely phrase it differently — different word order, a
    repeated alias, or a suffix the running text drops — so this instead masks
    every contiguous run of subject words that appears in the text (longest
    first, so a full phrase like "Sylvanus Thayer House" reads naturally as one
    "this subject", while a later standalone alias like "simply Krzewina" still
    gets caught). Runs made up only of generic type words ("railway station")
    are never replaced on their own, so unrelated mentions of common nouns
    elsewhere in the text survive untouched.

    Returns None if a real (non-generic) identifying word still survives the
    mask — callers should skip the fact rather than ship a leaking clue.
    """
    words = _name_words(subject)
    if not words:
        return text  # nothing distinctive to leak (e.g. a single short word)

    leak_words = {
        w.lower() for w in words
        if len(w) >= 4 and w.lower() not in _STOPWORDS and w.lower() not in _GENERIC_TYPE_WORDS
    }
    leak_idx = {i for i, w in enumerate(words) if w.lower() in leak_words}

    placeholder = "this " + _subject_class(fact)
    masked = text
    for n in range(len(words), 0, -1):
        for i in range(len(words) - n + 1):
            if not (set(range(i, i + n)) & leak_idx):
                continue  # purely generic run — don't touch unrelated text
            run = re.escape(" ".join(words[i : i + n]))
            masked = re.sub(rf"\b{run}\b", placeholder, masked, flags=re.IGNORECASE)

    # collapse a leftover article right before the placeholder ("The this X" → "this X")
    masked = re.sub(rf"\b(?:the|a|an)\s+({re.escape(placeholder)})\b", r"\1", masked, flags=re.IGNORECASE)
    if masked:
        masked = masked[0].upper() + masked[1:]

    remaining = {w.lower() for w in re.findall(r"[^\d\W]+", masked)}
    if leak_words & remaining:
        return None
    return masked


# ── daily board (deterministic, shared) ─────────────────────────────────────
def _clue_quality(q: dict) -> float:
    """§3.18 score forge_all stashed in meta; 0.5 if absent (hand-built rows)."""
    return (q.get("meta") or {}).get("quality", 0.5)


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
            # §3.18: prefer good clues over thin/ambiguous ones, but keep daily
            # rotation — sort by quality desc, then pick within the top slice so
            # the board varies day to day without ever scraping the barrel.
            tier = sorted(tier, key=_clue_quality, reverse=True)
            top = tier[: max(3, len(tier) // 4)]
            col.append(rng.choice(top)["content_hash"])
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


def _strip_leaky_music_art(facts: list[dict]) -> None:
    """Album covers embed the artist/album name as text; in a music clue
    (answer = the masked subject) that hands the answer over in the image.
    Strip cover art from music facts — keep /images/artist/ portraits (faces,
    no title text, a fair visual clue)."""
    for f in facts:
        if f.get("category") == "music" and "/images/cover/" in (f.get("image_url") or ""):
            f["image_url"] = None


def forge_all(facts: list[dict], seed: int = 0) -> list[dict]:
    rng = random.Random(seed)
    assign_difficulty(facts)
    _strip_leaky_music_art(facts)  # §3.13: album covers leak the answer in clue mode
    clues = forge_clues(facts, rng)
    questions = (
        forge_year_guess(facts)
        + forge_audio(facts)
        + forge_higher_lower(facts, rng)
        + forge_multiple_choice(facts, rng)
        + forge_trivia(facts, rng)
        + clues
        + forge_where(facts)
        + forge_seance(facts)
        + forge_ladder(facts, rng)
        + forge_thread(clues, rng)  # chains masked clues by theme (THE THREAD)
    )
    # §3.18: tag each question with a quality/ambiguity score the board sorts on.
    # Lives in meta (forge-only, not a DB column) — board selection happens here
    # at forge time, so the score never needs to round-trip through Postgres.
    for q in questions:
        q.setdefault("meta", {})["quality"] = quality_score(q)
    return questions


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-bronze", action="store_true", help="offline: forge from data/raw/*.jsonl")
    ap.add_argument(
        "--min-questions",
        type=int,
        default=0,
        help="health floor: exit non-zero if fewer than N questions are forged "
        "(catches total/per-source data decay in CI). 0 = off.",
    )
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

    # Health floor: a collapsed ingest (e.g. wikipedia 403s) yields a near-empty
    # forge. Fail loudly instead of letting export_seed quietly keep the stale bank.
    if args.min_questions and len(questions) < args.min_questions:
        raise SystemExit(
            f"health gate: forged {len(questions)} questions, floor is "
            f"{args.min_questions} ({by_type}) — likely a starved ingest, refusing the run"
        )

    n = upsert_questions(conn, questions)
    board = build_daily_board(questions, date.today())
    if conn is not None and board and upsert_daily_set(conn, board):
        console.print("[green]✓ daily board published[/green]")
    console.print(f"[green]✓ {n} questions upserted[/green]")


if __name__ == "__main__":
    main()
