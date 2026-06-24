"""
trivia_ingest.py
----------------
Ready-made trivia Q&A → facts. Three public APIs that already ship questions:

- Open Trivia DB  (https://opentdb.com)   — keyless, MC + boolean, categorised
- jService        (http://jservice.io)    — keyless, real Jeopardy clues + values
- QuizAPI         (https://quizapi.io)     — key (QUIZAPI_KEY), tech/dev MC

The repo convention is "scrape facts, not questions; only question_forge makes
questions" — so we DON'T write to the question bank here. Each item is normalised
into a fact:

- jService clues → plain facts (fact_text = clue, subject = answer). forge_clues
  already turns these into THE BOARD clues (with same-category distractors).
- opentdb / QuizAPI MC → facts tagged meta.trivia_q with meta.choices (the source's
  own correct+incorrect answers). forge_trivia emits a multiple_choice that keeps
  those distractors; forge_clues also picks them up as board clues (boolean items
  are skipped — useless as clues and as distractors).

Difficulty: the sources label easy/medium/hard; we map that to a popularity proxy
so question_forge.assign_difficulty ranks them sensibly alongside Wikipedia facts.

Run:
    python trivia_ingest.py                  # all three sources, default volume
    python trivia_ingest.py --opentdb 100    # 100 opentdb questions only
    python trivia_ingest.py --no-jservice    # skip a flaky source
Schedule: daily via etl_daily.yml
"""

from __future__ import annotations

import argparse
import html
import os
import time

import requests

from common import console, dump_raw, get_json, get_db, make_fact, upsert_facts

# ── category mapping ────────────────────────────────────────────────────────
# PARLOR categories: history, music, sports, screen, geography, wildcard.
_OPENTDB_MAP = {
    "Entertainment: Film": "screen",
    "Entertainment: Television": "screen",
    "Entertainment: Music": "music",
    "Entertainment: Musicals & Theatres": "music",
    "Sports": "sports",
    "Geography": "geography",
    "History": "history",
}
# everything else (Science*, General Knowledge, Mythology, Art, Animals, Games,
# Books, Comics, Anime, Politics, Celebrities, Vehicles, …) → the catch-all.
_DIFF_POP = {"easy": 90.0, "medium": 55.0, "hard": 20.0}


def _clean(s: str) -> str:
    # opentdb/quizapi HTML-encode entities (&quot;, &#039;, …)
    return html.unescape(s or "").strip()


def _map_opentdb_category(name: str) -> str:
    return _OPENTDB_MAP.get(name, "wildcard")


# ── Open Trivia DB ──────────────────────────────────────────────────────────
def fetch_opentdb(limit: int) -> list[dict]:
    """opentdb caps at 50 questions/request and rate-limits to ~1 req / 5s.
    `type=multiple` only — boolean (true/false) makes a poor clue and a poor
    distractor pool."""
    out: list[dict] = []
    remaining = limit
    while remaining > 0:
        amount = min(50, remaining)
        try:
            data = get_json(
                "https://opentdb.com/api.php",
                params={"amount": amount, "type": "multiple"},
            )
        except Exception as e:
            console.print(f"[yellow]opentdb fetch stopped: {type(e).__name__}[/yellow]")
            break
        results = (data or {}).get("results") or []
        if not results:
            break
        for q in results:
            answer = _clean(q.get("correct_answer", ""))
            if not answer:
                continue
            choices = [answer] + [_clean(a) for a in q.get("incorrect_answers", [])]
            choices = [c for c in dict.fromkeys(choices) if c]  # dedupe, keep order
            if len(choices) < 3:
                continue
            cat = _map_opentdb_category(q.get("category", ""))
            out.append(
                make_fact(
                    source="opentdb",
                    category=cat,
                    subject=answer,
                    fact_text=_clean(q.get("question", "")),
                    popularity=_DIFF_POP.get(q.get("difficulty"), 50.0),
                    source_url="https://opentdb.com",
                    meta={"trivia_q": True, "choices": choices},
                )
            )
        remaining -= amount
        if remaining > 0:
            time.sleep(5)  # respect opentdb's documented rate limit
    return out


# ── jService (Jeopardy) ─────────────────────────────────────────────────────
def fetch_jservice(limit: int) -> list[dict]:
    """jService /random returns up to 100 clues/call with category + value.
    Often flaky/down — wrapped so a failure just yields nothing. We skip clues
    whose answer is empty or leaks into the clue text (forge_clues re-checks)."""
    out: list[dict] = []
    remaining = limit
    while remaining > 0:
        count = min(100, remaining)
        # jService.io is frequently down. Use a direct, single, short-timeout
        # request (NOT get_json, whose retry/backoff would hang the whole nightly
        # for minutes when the host is dead) so a failure costs ~6s and we move on.
        try:
            resp = requests.get(
                "http://jservice.io/api/random",
                params={"count": count},
                headers={"User-Agent": "parlor-etl"},
                timeout=6,
            )
            resp.raise_for_status()
            rows = resp.json()
        except Exception as e:
            console.print(f"[yellow]jservice unavailable ({type(e).__name__}) — skipping[/yellow]")
            break
        if not rows:
            break
        for c in rows:
            answer = _clean(c.get("answer", ""))
            clue = _clean(c.get("question", ""))
            # jService answers sometimes carry <i>…</i> markup
            answer = answer.replace("<i>", "").replace("</i>", "").strip()
            if not answer or not clue or len(clue) < 12:
                continue
            value = c.get("value") or 200
            # value 200..1000 → popularity 90..20 (cheap clue = well-known = easy)
            pop = max(10.0, 100.0 - (value / 1000.0) * 80.0)
            out.append(
                make_fact(
                    source="jservice",
                    category="wildcard",  # jService categories are freeform; bucket as catch-all
                    subject=answer,
                    fact_text=clue,
                    popularity=pop,
                    source_url="http://jservice.io",
                    meta={"jeopardy": True},
                )
            )
        remaining -= count
    return out


# ── QuizAPI ─────────────────────────────────────────────────────────────────
def fetch_quizapi(limit: int) -> list[dict]:
    """QuizAPI is mostly technical/programming trivia → bucket as wildcard.
    Needs QUIZAPI_KEY. Answers come as answers{answer_a..f} + correct_answers
    {answer_a_correct: "true"|"false"}. Max 20 questions/request."""
    key = (os.environ.get("QUIZAPI_KEY") or "").strip().strip('"').strip("'")
    if not key:
        console.print("[yellow]QUIZAPI_KEY not set — skipping QuizAPI[/yellow]")
        return []
    out: list[dict] = []
    remaining = limit
    while remaining > 0:
        amount = min(20, remaining)
        try:
            # QuizAPI's documented auth is the X-Api-Key header; also pass apiKey
            # as a query param for belt-and-suspenders across their auth styles.
            rows = get_json(
                "https://quizapi.io/api/v1/questions",
                params={"apiKey": key, "limit": amount},
                headers={"X-Api-Key": key},
            )
        except Exception as e:
            console.print(f"[yellow]quizapi fetch stopped: {type(e).__name__}[/yellow]")
            break
        if not rows:
            break
        for q in rows:
            answers = q.get("answers") or {}
            correct = q.get("correct_answers") or {}
            opts = {k: _clean(v) for k, v in answers.items() if v}
            correct_vals = [
                opts[k.replace("_correct", "")]
                for k, v in correct.items()
                if str(v).lower() == "true" and opts.get(k.replace("_correct", ""))
            ]
            if len(correct_vals) != 1:
                continue  # skip multi-answer / unanswerable
            answer = correct_vals[0]
            choices = [c for c in dict.fromkeys([answer, *opts.values()]) if c]
            if len(choices) < 3:
                continue
            out.append(
                make_fact(
                    source="quizapi",
                    category="wildcard",
                    subject=answer,
                    fact_text=_clean(q.get("question", "")),
                    popularity=_DIFF_POP.get(q.get("difficulty", "").lower(), 40.0),
                    source_url="https://quizapi.io",
                    meta={"trivia_q": True, "choices": choices},
                )
            )
        remaining -= amount
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest ready-made trivia Q&A as facts.")
    ap.add_argument("--opentdb", type=int, default=150, help="opentdb questions (0 to skip)")
    ap.add_argument("--jservice", type=int, default=200, help="jService clues (0 to skip)")
    ap.add_argument("--quizapi", type=int, default=60, help="QuizAPI questions (0 to skip)")
    ap.add_argument("--no-jservice", action="store_true", help="skip jService (often down)")
    args = ap.parse_args()

    facts: list[dict] = []
    if args.opentdb:
        f = fetch_opentdb(args.opentdb)
        console.print(f"opentdb ▸ {len(f)} facts")
        facts += f
    if args.jservice and not args.no_jservice:
        f = fetch_jservice(args.jservice)
        console.print(f"jservice ▸ {len(f)} facts")
        facts += f
    if args.quizapi:
        f = fetch_quizapi(args.quizapi)
        console.print(f"quizapi ▸ {len(f)} facts")
        facts += f

    if not facts:
        console.print("[yellow]no trivia facts collected[/yellow]")
        return

    dump_raw("trivia", facts)
    conn = get_db()
    if conn:
        n = upsert_facts(conn, facts)
        console.print(f"[green]✓ {len(facts)} facts collected, {n} upserted[/green]")
    else:
        console.print(f"[green]✓ {len(facts)} facts collected (bronze-only mode)[/green]")


if __name__ == "__main__":
    main()
