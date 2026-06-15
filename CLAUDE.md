# CLAUDE.md — PARLOR (trivia-generator)

This file instructs Claude Code on how to work in this repository.

## Project Overview

PARLOR is a pipeline-driven trivia web app: six game rooms (Board/Jeopardy,
Clock/WhenTaken, Wedges/Trivial-Pursuit, Streak/higher-lower, Map/GeoGuessr,
Daily/Wordle-loop) rendered over one question bank forged nightly from
Wikipedia, Deezer, Sleeper/ESPN, TMDB, and restcountries. `databricks/` holds
the Phase-2 Delta Lake mirror lab (never the serving path).

## Stack Summary

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion
- **Backend/DB**: Neon (serverless Postgres); `lib/db.ts` query helper, seed-bank fallback
- **Pipeline**: Python 3.11 scripts on GitHub Actions cron (`etl_daily.yml`)
- **Transform**: dbt Core + DuckDB in `transform/` (bronze JSONL → staging → marts, schema tests gate publish)
- **Offline mode**: `frontend/public/seed-questions.json` — app is fully playable with zero env vars

## Key Files

| File | Purpose |
|---|---|
| `db/schema.sql` | full schema (facts, questions, daily_sets) — `psql "$DATABASE_URL" -f db/schema.sql` |
| `pipeline/common.py` | shared helpers: retries, fact factory, bronze dumps, upserts |
| `pipeline/question_forge.py` | THE core: facts → typed questions + daily board |
| `pipeline/selftest.py` | offline CI gate — run before committing pipeline changes |
| `transform/` | dbt project (`dbt build --profiles-dir .` from inside it) |
| `frontend/lib/queries.ts` | ALL data access; Neon (`lib/db.ts`) with seed-bank fallback |
| `frontend/lib/types.ts` | Question shape + category palette (single source) |
| `docs/UI_SPEC.md` | design tokens + component guide |

## Conventions

### Python pipeline
- argparse flags for targeted runs; tenacity retries (3, exponential); rich console;
  dotenv secrets; **idempotent upserts on `content_hash`**
- every ingest ALSO appends to `data/raw/*.jsonl` (bronze, **committed** and
  compacted by `content_hash` — the repo is the database in DB-less mode); never
  skip this, dbt and the forge read it; never hand-edit these files
- scrape **facts**, not questions; only `question_forge.py` creates questions

### TypeScript / Next.js
- App Router only; Server Components by default; `"use client"` only for game interactivity
- all reads through `lib/queries.ts`; client null-safe (no env ⇒ seed bank, never throw)
- frontend NEVER writes to the database (scores live in localStorage); reads use a read-only Neon role
- daily/shared game setups must use `lib/rng.ts` date-seeded PRNG (SSR/client
  consistency); free shuffles only inside click handlers or effects
- THE MAP renders offline via `world-atlas` land polygons (`components/WorldMap.tsx`)
  — never add tile-server dependencies
- category colors come from `lib/types.ts` `CATEGORY_HEX` + tailwind safelist

### Database
- writes via the pipeline's `DATABASE_URL` role only; frontend uses a read-only role
- connection in `pipeline/common.py` `get_db()` (psycopg2) and `frontend/lib/db.ts` (Neon serverless); both null-safe → bronze/seed fallback
- new tables: keep RLS on + public-read policy (harmless on Neon); migrations in `db/migrations/` timestamp-prefixed

## Common tasks

### Add a new question type
1. recipe in `pipeline/question_forge.py` + check in `selftest.py`
2. `qtype` enum in `db/schema.sql` AND `frontend/lib/types.ts`
3. render it in the relevant room component

### Add a new game room
1. `frontend/app/{room}/page.tsx` (server: fetch + arrange) + `components/{Room}Game.tsx` (client)
2. wrap in `RoomShell`, add a `RoomCard` on the home page
3. document in `docs/GAME_MODES.md`

### Debugging the pipeline offline (no keys)
```bash
cd pipeline
python selftest.py                       # never needs network
python question_forge.py --from-bronze   # forge from data/raw/*.jsonl
python export_seed.py --from-bronze      # regenerate seed bank locally
```

## Do Not
- Do not commit `.env` / service-role keys
- Do not write to the database from the frontend
- Do not store questions without a `fact` provenance trail (`source_url`)
- Do not use `Math.random()` during SSR render paths (hydration) — see `lib/rng.ts`
- Do not bypass dbt tests in CI — they gate the publish on purpose
