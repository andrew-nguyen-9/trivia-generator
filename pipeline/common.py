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
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TypeVar

import requests
from dotenv import load_dotenv
from rich.console import Console
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception,
    RetryError,
    after_log,
)

load_dotenv()
console = Console()

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
CACHE_DIR = REPO_ROOT / "data" / "cache"

USER_AGENT = "parlor-trivia/1.0 (https://github.com/andrew-nguyen-9/trivia-generator)"

CATEGORIES = ("history", "music", "sports", "screen", "geography", "wildcard")

# ── Rate Limiting & Telemetry ──────────────────────────────────────────

class RateLimitTracker:
    """Thread-safe tracker for API call telemetry and adaptive rate limiting.
    
    Attributes:
        session_id: Unique ID for this invocation (for log correlation)
        calls_made: Total HTTP requests attempted
        calls_succeeded: Total successful responses (2xx-3xx)
        calls_rate_limited: Total 429 responses
        calls_failed: Total other HTTP errors
        total_retry_wait_seconds: Cumulative wait time across retries
        last_call_time: Timestamp of most recent API call
    """
    
    def __init__(self):
        self.session_id = str(uuid.uuid4())[:8]
        self.calls_made = 0
        self.calls_succeeded = 0
        self.calls_rate_limited = 0
        self.calls_failed = 0
        self.total_retry_wait_seconds = 0
        self.last_call_time = 0.0
        self._start_time = time.time()
    
    def log_call(self, status_code: int, wait_seconds: float = 0) -> None:
        """Record an API call outcome."""
        self.calls_made += 1
        self.last_call_time = time.time()
        self.total_retry_wait_seconds += wait_seconds
        
        if 200 <= status_code < 400:
            self.calls_succeeded += 1
        elif status_code == 429:
            self.calls_rate_limited += 1
        else:
            self.calls_failed += 1
    
    def stats_summary(self) -> str:
        """Return a debug summary of telemetry."""
        elapsed = time.time() - self._start_time
        return (
            f"session={self.session_id} elapsed={elapsed:.1f}s "
            f"calls={self.calls_made} success={self.calls_succeeded} "
            f"rate_limited={self.calls_rate_limited} failed={self.calls_failed} "
            f"retry_wait={self.total_retry_wait_seconds:.1f}s"
        )


_tracker = RateLimitTracker()


def get_request_id() -> str:
    """Return a debug-friendly request correlation ID."""
    return _tracker.session_id


# ── HTTP Client with Adaptive Rate Limiting ────────────────────────────

class _RateLimitedSession:
    """Manages per-domain rate limiting with adaptive backoff."""
    
    def __init__(self, min_interval_seconds: float = 1.5):
        self.min_interval = min_interval_seconds
        self.domain_last_call: dict[str, float] = {}
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL for rate-limit bucketing."""
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc or "unknown"
        except Exception:
            return "unknown"
    
    def _enforce_interval(self, url: str) -> None:
        """Sleep until min_interval has elapsed since last call to this domain."""
        domain = self._extract_domain(url)
        last = self.domain_last_call.get(domain, 0)
        elapsed = time.time() - last
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            console.print(
                f"[dim][{_tracker.session_id}] rate-limit throttle: "
                f"sleeping {sleep_time:.2f}s for {domain}[/dim]"
            )
            time.sleep(sleep_time)
        self.domain_last_call[domain] = time.time()


_rate_limiter = _RateLimitedSession()


def _is_retryable_error(exc: Exception) -> bool:
    """Determine if an exception warrants a retry.
    
    Retries on:
    - 429 (rate limit)
    - 503/504 (service unavailable / gateway timeout)
    - Connection errors / timeouts
    - Do NOT retry on 4xx client errors (bad request, not found, etc.)
    """
    if not isinstance(exc, requests.exceptions.RequestException):
        return False
    
    if isinstance(exc, (requests.exceptions.Timeout, requests.exceptions.ConnectionError)):
        return True
    
    if isinstance(exc, requests.exceptions.HTTPError):
        code = exc.response.status_code
        return code in (429, 503, 504)
    
    return False


def _after_retry_log(retry_state) -> None:
    """Log retry attempts with full diagnostic context."""
    attempt = retry_state.attempt_number
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    
    status_code = "unknown"
    if isinstance(exc, requests.exceptions.HTTPError):
        status_code = exc.response.status_code
    
    console.print(
        f"[yellow][{_tracker.session_id}] RETRY #{attempt}: "
        f"{type(exc).__name__} (status={status_code})[/yellow]"
    )


@retry(
    stop=stop_after_attempt(8),  # 8 attempts for max resilience
    wait=wait_exponential(multiplier=2, min=1, max=60),  # 1s → 2s → 4s → 8s → 16s → 32s → 60s → 60s
    retry=retry_if_exception(_is_retryable_error),
    reraise=True,
)
def get_json(url: str, params: dict | None = None, headers: dict | None = None) -> dict | list:
    """HTTP GET with adaptive rate limiting, intelligent retries, and telemetry.
    
    Args:
        url: The URL to fetch.
        params: Optional query parameters.
        headers: Optional custom headers (merged with User-Agent).
    
    Returns:
        Parsed JSON response.
    
    Raises:
        requests.exceptions.HTTPError: After 8 retries or on non-retryable errors.
        tenacity.RetryError: If all retries exhausted.
    """
    # Enforce per-domain rate limiting
    _rate_limiter._enforce_interval(url)
    
    # Build headers
    h = {"User-Agent": USER_AGENT}
    if headers:
        h.update(headers)
    
    # Attempt the call
    try:
        resp = requests.get(url, params=params, headers=h, timeout=20)
        _tracker.log_call(resp.status_code, wait_seconds=0)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError as e:
        # Log detail for debugging
        console.print(
            f"[red][{_tracker.session_id}] HTTP {e.response.status_code}: {e.response.reason} "
            f"@ {url}[/red]"
        )
        raise
    except Exception as e:
        console.print(
            f"[red][{_tracker.session_id}] Request failed: {type(e).__name__} @ {url}[/red]"
        )
        raise


@retry(
    stop=stop_after_attempt(8),
    wait=wait_exponential(multiplier=2, min=1, max=60),
    retry=retry_if_exception(_is_retryable_error),
    after=_after_retry_log,
    reraise=True,
)
def get_json_conditional(
    url: str,
    cache_path: Path,
    params: dict | None = None,
    max_age_seconds: int = 7 * 86400,
) -> dict | list:
    """GET with ETag/If-Modified-Since caching — returns cached data on 304.

    Stores {etag, last_modified, timestamp, data} in cache_path as JSON.
    Falls back to unconditional GET if the cache file is missing or unreadable.

    Shares get_json()'s per-domain throttle and 429/503/504-aware retry —
    CI runners start with an empty data/cache/ (it's gitignored and not
    persisted between workflow runs), so every run does a full fetch; this
    must be just as resilient to rate limiting as get_json().
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache: dict = {}
    if cache_path.exists():
        try:
            cache = json.loads(cache_path.read_text())
        except Exception:
            cache = {}

    # Serve from cache if fresh enough
    cached_at = cache.get("timestamp", 0)
    now = datetime.now(timezone.utc).timestamp()
    if cache.get("data") and (now - cached_at) < max_age_seconds:
        console.print(f"[dim]cache hit → {cache_path.name} (age {int(now - cached_at)}s)[/dim]")
        return cache["data"]

    _rate_limiter._enforce_interval(url)

    h = {"User-Agent": USER_AGENT}
    if cache.get("etag"):
        h["If-None-Match"] = cache["etag"]
    if cache.get("last_modified"):
        h["If-Modified-Since"] = cache["last_modified"]

    try:
        resp = requests.get(url, params=params, headers=h, timeout=30)
        _tracker.log_call(resp.status_code, wait_seconds=0)

        if resp.status_code == 304 and cache.get("data"):
            console.print(f"[dim]304 Not Modified → reusing {cache_path.name}[/dim]")
            cache["timestamp"] = now
            cache_path.write_text(json.dumps(cache))
            return cache["data"]

        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        console.print(
            f"[red][{_tracker.session_id}] HTTP {e.response.status_code}: {e.response.reason} "
            f"@ {url}[/red]"
        )
        raise
    except Exception as e:
        console.print(
            f"[red][{_tracker.session_id}] Request failed: {type(e).__name__} @ {url}[/red]"
        )
        raise

    data = resp.json()
    cache = {
        "etag": resp.headers.get("ETag"),
        "last_modified": resp.headers.get("Last-Modified"),
        "timestamp": now,
        "data": data,
    }
    cache_path.write_text(json.dumps(cache))
    console.print(f"[dim]cache refreshed → {cache_path.name}[/dim]")
    return data


def load_json_cache(cache_path: Path, max_age_seconds: int = 7 * 86400) -> dict | list | None:
    """Return cached data if the file exists and is younger than max_age_seconds."""
    if not cache_path.exists():
        return None
    try:
        cache = json.loads(cache_path.read_text())
    except Exception:
        return None
    age = datetime.now(timezone.utc).timestamp() - cache.get("timestamp", 0)
    if age > max_age_seconds:
        return None
    return cache.get("data")


def save_json_cache(cache_path: Path, data: dict | list) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps({
        "timestamp": datetime.now(timezone.utc).timestamp(),
        "data": data,
    }))


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
    lat: float | None = None,
    lng: float | None = None,
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
        "lat": lat,
        "lng": lng,
        "image_url": image_url,
        "source_url": source_url,
        "popularity": popularity,
        "meta": meta or {},
    }


def compact_jsonl(path: Path) -> int:
    """Dedupe a bronze file by content_hash — the repo IS the database in
    DB-less mode, so files must not grow with daily re-ingests.

    Rules for git-friendly diffs:
    - unchanged payloads keep their ORIGINAL line (and _ingested_at), so a
      re-ingested identical fact produces zero diff
    - changed payloads take the newest line
    - output sorted by content_hash (stable ordering)
    """
    rows: dict[str, dict] = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        key = row.get("content_hash") or json.dumps(row, sort_keys=True, default=str)
        prev = rows.get(key)
        if prev is not None:
            a = {k: v for k, v in prev.items() if k != "_ingested_at"}
            b = {k: v for k, v in row.items() if k != "_ingested_at"}
            if a == b:
                continue
        rows[key] = row
    path.write_text("".join(json.dumps(rows[k], default=str) + "\n" for k in sorted(rows)))
    return len(rows)


def dump_raw(name: str, rows: list[dict]) -> Path:
    """Append rows to the bronze layer (data/raw/{name}.jsonl), then compact."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"{name}.jsonl"
    stamp = datetime.now(timezone.utc).isoformat()
    with path.open("a") as f:
        for row in rows:
            f.write(json.dumps({"_ingested_at": stamp, **row}, default=str) + "\n")
    total = compact_jsonl(path)
    console.print(
        f"[dim]bronze ▸ appended {len(rows)} rows to {path.relative_to(REPO_ROOT)} "
        f"({total} after compaction)[/dim]"
    )
    return path


# ── per-source health floor (§3.17, debt #3) ────────────────────────────────
# A *total* question floor (question_forge --min-questions) is an OR over
# sources — one healthy ingest clears it alone, so a single source can die and
# the bank rots silently. The floor below is an AND over every live
# (source, category) bucket instead, so the next starvation pages someone.
HEALTH_FLOOR = 10  # min facts a live (source, category) bucket must hold.

# The hand-`curated` baseline is exempt: its tiny per-category buckets are
# deliberate offline fallback, not live-ingest output, so they aren't "decay".
_HEALTH_EXEMPT_SOURCES = frozenset({"curated"})


def bronze_bucket_counts(exclude: frozenset[str] = _HEALTH_EXEMPT_SOURCES) -> dict[tuple[str, str], int]:
    """Facts per (source, category) across the bronze layer, for the health gate."""
    counts: dict[tuple[str, str], int] = {}
    for path in RAW_DIR.glob("*.jsonl"):
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            src = row.get("source")
            if not src or src in exclude:
                continue
            key = (str(src), row.get("category"))
            counts[key] = counts.get(key, 0) + 1
    return counts


def starved_buckets(counts: dict, floor: int = HEALTH_FLOOR) -> list:
    """Bucket keys whose fact count is below `floor` — a starved source/category
    the nightly should fail on rather than let rot. Pure (takes the counts dict,
    not the disk) so the gate is testable without a bronze fixture.

    # ponytail: flags present-but-thin buckets; a source that stops writing
    # entirely keeps its old committed bronze facts, so a true zero is caught by
    # the DB-side total floor, not here (the offline gate only sees the repo).
    """
    return sorted(k for k, n in counts.items() if n < floor)


# ── database (Neon / any Postgres) ──────────────────────────────────────────
# Writes go to a plain Postgres database via psycopg2 — Neon is the default host
# (serverless, scale-to-zero, generous free tier). The connection string lives in
# DATABASE_URL (or NEON_DATABASE_URL). Unconfigured ⇒ None ⇒ bronze-only mode, so
# the pipeline still runs from a clone with zero secrets (the repo is the DB).

# columns written per table — order matters, must match the VALUES tuples below.
_FACT_COLS = (
    "content_hash", "source", "category", "subject", "fact_text", "year",
    "numeric_value", "numeric_unit", "lat", "lng", "image_url", "source_url",
    "popularity", "meta",
)
_FACT_JSONB = {"meta"}

_QUESTION_COLS = (
    "content_hash", "qtype", "category", "difficulty", "prompt", "correct",
    "choices", "year", "value_a", "value_b", "subject_a", "subject_b", "unit",
    "lat", "lng", "image_url", "source_url", "clues", "candidates",
    "chain", "theme", "theme_choices",
)
_QUESTION_JSONB = {"choices", "clues", "candidates", "chain", "theme_choices"}


def get_db():
    """psycopg2 connection for pipeline writes. Returns None when unconfigured
    (offline/dev mode) — callers must tolerate that and still write bronze."""
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("NEON_DATABASE_URL")
    if not dsn:
        console.print("[yellow]DATABASE_URL / NEON_DATABASE_URL not set — bronze-only mode[/yellow]")
        return None
    import psycopg2  # lazy: selftest and offline forges never import the driver

    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    return conn


def _upsert(conn, table: str, cols: tuple[str, ...], jsonb: set[str],
            rows: list[dict], conflict: str) -> int:
    """Generic INSERT ... ON CONFLICT DO UPDATE keyed on `conflict`.

    jsonb columns are wrapped with psycopg2's Json adapter; every non-conflict
    column is refreshed on conflict so re-forges overwrite cleanly.
    """
    if conn is None or not rows:
        return 0
    from psycopg2.extras import Json, execute_values

    updates = ", ".join(f"{c} = excluded.{c}" for c in cols if c not in conflict.split(","))
    sql = (
        f"insert into {table} ({', '.join(cols)}) values %s "
        f"on conflict ({conflict}) do update set {updates}"
    )
    values = [
        tuple(Json(r.get(c)) if c in jsonb else r.get(c) for c in cols)
        for r in rows
    ]
    with conn.cursor() as cur:
        execute_values(cur, sql, values, page_size=500)
    return len(rows)


def upsert_facts(conn, facts: list[dict]) -> int:
    return _upsert(conn, "facts", _FACT_COLS, _FACT_JSONB, facts, "content_hash")


def upsert_questions(conn, questions: list[dict]) -> int:
    return _upsert(conn, "questions", _QUESTION_COLS, _QUESTION_JSONB, questions, "content_hash")


def upsert_daily_set(conn, board: dict) -> int:
    """daily_sets is keyed on (set_date, mode); payload is jsonb."""
    if conn is None or not board:
        return 0
    from psycopg2.extras import Json
    with conn.cursor() as cur:
        cur.execute(
            "insert into daily_sets (set_date, mode, payload) values (%s, %s, %s) "
            "on conflict (set_date, mode) do update set payload = excluded.payload",
            (board["set_date"], board["mode"], Json(board["payload"])),
        )
    return 1


def fetch_all(conn, sql: str, limit: int = 20000) -> list[dict]:
    """Read helper — returns rows as dicts. Used by the forge / seed export."""
    if conn is None:
        return []
    from psycopg2.extras import RealDictCursor
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql + f" limit {int(limit)}")
        return [dict(r) for r in cur.fetchall()]
