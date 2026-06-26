"""
distractor_quality.py — §3.12: keep multiple-choice distractors *close* to the
answer so the right option doesn't stick out.

The forge synthesises distractors by sampling siblings from the same category
(`question_forge._clue_distractors`, `forge_multiple_choice`). Same-category
keeps them the same *kind*, but not the same *scale* or *era* — a 7-figure
population sat next to single digits, or a year next to three place-names, is
guessable without knowing the answer. This module adds one shared closeness
heuristic used by both the selector and the gate.

The heuristic (documented, deliberately ML-free — ponytail):
  classify(s) sorts a choice string into one of three axes —
    • year   : a bare 1000–2100 value ("1994", "1990s")      → distance = |Δyears|
    • number : a bare numeric string ("1,500,000", "3.14")    → distance = |Δlog10|
    • text   : everything else (entity / place / title)       → distance = shape
                                                                  (word-count gap*10
                                                                   + char-length gap)
  closest()           picks the k nearest same-axis candidates (then samples a
                      small slice for variety), so a year draws nearby years and
                      a 7-figure number draws other 7-figure numbers.
  separable_reason()  flags a finished choice set whose correct answer is a lone
                      outlier — a different axis from the rest, or > OUTLIER_RATIO×
                      the distractors' own spread. selftest.py asserts the forge
                      emits none of these.
"""

from __future__ import annotations

import math
import random
import re

# correct must be this many times further from its nearest neighbour than the
# distractors are from each other before we call the set trivially separable.
# ponytail: a single constant, tune if real banks over/under-trip it.
OUTLIER_RATIO = 3.0

# ...and at least this far in absolute terms, so noise below the "obviously
# wrong" threshold never trips the gate: a year within ~a generation, a number
# inside the same order of magnitude. (Text isn't gated on shape — see _outlier.)
FLOOR = {"year": 30.0, "number": 1.0}

_YEAR = re.compile(r"^(?:c\.?)?(\d{3,4})s?(?:bc|bce|ad|ce)?$", re.I)
# bare unsigned magnitude only — trivia answers (populations, fans, years) never
# carry a sign, so a leading +/- marks a label/code ("+44" the band), not a number.
_NUM_FULL = re.compile(r"^\d+(?:\.\d+)?$")


def classify(s: str) -> tuple[str, float | None]:
    """('year'|'number'|'text', value). Only *bare* numerics count as year/number
    so an entity that merely contains a digit ('Apollo 11') stays text."""
    t = s.strip()
    m = _YEAR.match(t.replace(" ", ""))
    if m:
        y = int(m.group(1))
        if 1000 <= y <= 2100:
            return "year", float(y)
    bare = t.replace(",", "").replace(" ", "")
    if _NUM_FULL.match(bare):
        return "number", float(bare)
    return "text", None


def distance(a: str, b: str) -> float:
    """Closeness on the answer's natural axis. Mixed/text axes fall back to a
    shape metric (word-count gap dominates, char length breaks ties)."""
    ca, va = classify(a)
    cb, vb = classify(b)
    if ca == cb == "year":
        return abs(va - vb)  # type: ignore[arg-type]
    if ca == cb == "number":
        return abs(math.log10(abs(va) + 1) - math.log10(abs(vb) + 1))  # type: ignore[arg-type]
    return abs(len(a.split()) - len(b.split())) * 10 + abs(len(a) - len(b))


def closest(
    answer: str, candidates: list[str], k: int, rng: random.Random
) -> list[str] | None:
    """k distractors closest to `answer`, deduped and excluding it. Prefers
    same-axis candidates (a year draws years); falls back to all uniques when an
    axis can't field k so we still return a full set. None when < k uniques."""
    seen = {answer.strip().lower()}
    uniq: list[str] = []
    for c in candidates:
        key = c.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    if len(uniq) < k:
        return None
    axis = classify(answer)[0]
    same = [c for c in uniq if classify(c)[0] == axis]
    pool = same if len(same) >= k else uniq
    pool.sort(key=lambda c: distance(answer, c))
    tight = pool[:k]  # the k strictly-closest — lowest possible outlier risk
    wide = pool[: max(k, min(len(pool), 3 * k))]  # widen for variety...
    pick = rng.sample(wide, k)
    if separable_reason([*pick, answer], answer) is None:
        return pick
    if separable_reason([*tight, answer], answer) is None:
        return tight  # ...but closeness wins when the wider sample breaks it
    return None  # category can't field a tight set — caller skips / falls back


def _outlier(opt: str, rest: list[str]) -> str | None:
    """Why `opt` is a trivial odd-one-out vs `rest`, else None. Two ways to stick
    out: a different *axis* from all the rest (a number among names), or — within a
    same dated/numeric set — sitting >= FLOOR and > OUTLIER_RATIO× further out than
    `rest`'s own spread (a 1500s year among a 1990s cluster, a 7-figure number
    among single digits). We deliberately do NOT flag text-vs-text shape gaps:
    "South America" among one-word continents reads fine and isn't guessable —
    word count is a useful selection hint (see `closest`) but a noisy reject rule."""
    if len(rest) < 2:
        return None
    oc = classify(opt)[0]
    rc = [classify(c)[0] for c in rest]
    if oc not in rc and len(set(rc)) == 1:
        return f"type-outlier ({oc} vs {rc[0]})"
    if oc in rc and len(set([oc, *rc])) == 1 and oc in ("year", "number"):
        d_opt = min(distance(opt, r) for r in rest)
        d_spread = max(distance(a, b) for a in rest for b in rest if a != b)
        if d_opt >= FLOOR[oc] and d_opt > OUTLIER_RATIO * max(d_spread, 1e-9):
            return f"{oc}-outlier ({d_opt:.3g} vs spread {d_spread:.3g})"
    return None


def separable_reason(choices: list[str], correct: str) -> str | None:
    """Why a choice set is trivially separable, else None. Per the spec, reject if
    *any* option is the odd one out — not only the correct one (a giveaway
    distractor also shrinks the real decision to a 1-in-3). The correct answer
    standing out is the worst case, so it's reported first."""
    ordered = [correct, *(c for c in choices if c != correct)]
    for opt in ordered:
        rest = [c for c in choices if c != opt]
        why = _outlier(opt, rest)
        if why:
            who = "correct" if opt == correct else "distractor"
            return f"{who} {opt!r} {why}"
    return None


def demo() -> None:
    """ponytail self-check: heuristic catches obvious outliers, passes tight sets,
    and `closest` repairs a mixed pool. Run: python distractor_quality.py"""
    assert classify("1994") == ("year", 1994.0)
    assert classify("1,500,000")[0] == "number"
    assert classify("Apollo 11") == ("text", None)
    assert classify("Paris") == ("text", None)

    # type mismatch: a year among place-names
    assert separable_reason(["Paris", "London", "Berlin", "1999"], "1999")
    # magnitude: a 7-figure answer among single digits
    assert separable_reason(["1500000", "12", "9", "11"], "1500000")
    # era: a 1500s answer among a tight 1990s cluster
    assert separable_reason(["1500", "1991", "1994", "1992"], "1500")
    # a giveaway *distractor* (a single digit among 7-figure numbers) also fails,
    # even though the correct answer isn't the outlier
    assert separable_reason(["1500000", "1200000", "9", "1100000"], "1500000")
    # tight sets pass
    assert separable_reason(["1500000", "1200000", "900000", "1100000"], "1500000") is None
    assert separable_reason(["Paris", "London", "Berlin", "Madrid"], "Paris") is None

    # closest repairs a mixed-magnitude pool
    rng = random.Random(1)
    pool = ["1200000", "900000", "1100000", "5", "12", "9"]
    d = closest("1500000", pool, 3, rng)
    assert d is not None and separable_reason([*d, "1500000"], "1500000") is None, d
    # too few uniques → None (caller falls back)
    assert closest("x", ["x", "x", "y"], 3, rng) is None
    print("distractor_quality demo: all assertions passed")


if __name__ == "__main__":
    demo()
