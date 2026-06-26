"""§3.18 — clue quality / ambiguity score.

The forge emits typed questions but doesn't rank them, so THE BOARD picks a
random clue per (category, difficulty) tier — a thin, gutted, or vague clue is
as likely to be chosen as a sharp one. `quality_score` is a cheap, pure
heuristic that scores how *answerable and unambiguous* a forged clue reads, so
the board can bias its pick toward good clues.

Heuristic, not a model (ponytail): an ambiguous clue is one that, after the
subject is masked out, could describe many subjects. We can't measure that
against the whole corpus cheaply, so we proxy it with three signals on the
prompt text:

  1. length band   — too short ⇒ thin/ambiguous; too long ⇒ the ask is buried.
  2. over-masking  — every "_____"/"this subject" blank removes a distinctive
                     token; 3+ blanks means the sentence got gutted.
  3. concrete anchor — a year, a number, or a mid-sentence proper noun gives the
                     solver something to grab; a clue with none is vaguer.

Returns 0..1, higher = better board pick. `databricks/` is the natural home for
a learned model later; until a judge measurably beats this, the heuristic ships.
"""
from __future__ import annotations

import re

# "this artist/player/team/title/subject/place" — the placeholders mask_subject
# leaves behind (see _subject_class in question_forge).
_MASK_RE = re.compile(r"\bthis (?:artist|player|team|title|subject|place)\b", re.I)
_YEAR_RE = re.compile(r"\b(?:1[5-9]\d\d|20\d\d)\b")
# a proper noun that isn't the sentence-initial capital (which every clue has)
_PROPER_RE = re.compile(r"(?<!^)(?<![.?!]\s)\b[A-Z][a-z]{2,}")


def quality_score(q: dict) -> float:
    """0..1 heuristic for how good a clue is for the board to pick. Pure."""
    prompt = (q.get("prompt") or "").strip()
    n = len(prompt)
    score = 1.0

    # 1. length band
    if n < 25:
        score -= 0.4
    elif n < 40:
        score -= 0.15
    elif n > 300:
        score -= 0.25
    elif n > 220:
        score -= 0.10

    # 2. over-masking gutted the sentence
    masks = prompt.count("_____") + len(_MASK_RE.findall(prompt))
    if masks >= 3:
        score -= 0.30
    elif masks == 2:
        score -= 0.10

    # 3. concrete anchor present?
    if _YEAR_RE.search(prompt) or _PROPER_RE.search(prompt):
        score += 0.15
    else:
        score -= 0.15

    return max(0.0, min(1.0, score))


def _demo() -> None:
    """ponytail: one runnable check — sharp clue must outrank thin/gutted/vague."""
    sharp = {"prompt": "In 1969, this crew first walked on the Moon during Apollo 11."}
    thin = {"prompt": "A place."}
    gutted = {"prompt": "this subject led this team, and this subject also coached."}
    vague = {"prompt": "it is a thing that does some stuff and other vague things too."}
    assert quality_score(sharp) > quality_score(vague) > quality_score(thin), "ordering"
    assert quality_score(sharp) > quality_score(gutted), "over-masking penalised"
    assert all(0.0 <= quality_score(q) <= 1.0 for q in (sharp, thin, gutted, vague)), "bounds"
    print("quality_score demo ok")


if __name__ == "__main__":
    _demo()
