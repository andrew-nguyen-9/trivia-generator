"""
common.py — shared helpers for all pipeline scripts.

Conventions (inherited from fantasy-football-tool / music-festival-analyzer):
- tenacity retries on every external call
- rich console output
- dotenv secrets, never committed
- idempotent upserts keyed on content_hash
- every script also appends raw payloads to data/raw/*.jsonl (the bronze layer)
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from rich.console import Console
from tenacity import retry, stop_after_attempt, wait_exponential

load_dotenv()
console = Console()

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"

USER_AGENT = "parlor-trivia/1.0 (https://github.com/andrew-nguyen-9/trivia-generator)"

CATEGORIES = ("history", "music", "sports", "screen", "geography", "wildcard")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def get_json(url: str, params: dict | None = None, headers: dict | None = None) -> dict | list:
    h = {"User-Agent": USER_AGENT}
    if headers:
        h.update(headers)
    resp = requests.get(url, params=params, headers=h, timeout=20)
    resp.raise_for_status()
    return resp.json()


def content_hash(*parts: str) -> str:
    return hashlib.sha256("||".join(p.strip().lower() for p in parts).encode()).hexdigest()[:32]


def make_fact(
    *,
    source: str,
    category: str,
    subject: str,
    fact_text: str,
    year: int | None = None,
    numeric_value: float | None = None,
    numeric_unit: str | None = None,
    image_url: str | None = None,
    source_url: str | None = None,
    popularity: float | None = None,
    meta: dict | None = None,
) -> dict:
    assert category in CATEGORIES, f"unknown category {category}"
    return {
        "content_hash": content_hash(source, subject, fact_text),
        "source": source,
        "category": category,
        "subject": subject,
        "fact_text": fact_text,
        "year": year,
        "numeric_value": numeric_value,
        "numeric_unit": numeric_unit,
        "image_url": image_url,
        "source_url": source_url,
        "popularity": popularity,
        "meta": meta or {},
    }


def dump_raw(name: str, rows: list[dict]) -> Path:
    """Append rows to the bronze layer (data/raw/{name}.jsonl)."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"{name}.jsonl"
    stamp = datetime.now(timezone.utc).isoformat()
    with path.open("a") as f:
        for row in rows:
            f.write(json.dumps({"_ingested_at": stamp, **row}, default=str) + "\n")
    console.print(f"[dim]bronze ▸ appended {len(rows)} rows to {path.relative_to(REPO_ROOT)}[/dim]")
    return path


def get_supabase():
    """Service-role client for pipeline writes. Returns None when unconfigured
    (offline/dev mode) — callers must tolerate that and still write bronze."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        console.print("[yellow]SUPABASE_URL / SERVICE_ROLE_KEY not set — bronze-only mode[/yellow]")
        return None
    from supabase import create_client

    return create_client(url, key)


def upsert_facts(sb, facts: list[dict]) -> int:
    if sb is None or not facts:
        return 0
    sb.table("facts").upsert(facts, on_conflict="content_hash").execute()
    return len(facts)


def upsert_questions(sb, questions: list[dict]) -> int:
    if sb is None or not questions:
        return 0
    sb.table("questions").upsert(questions, on_conflict="content_hash").execute()
    return len(questions)
