# Architecture

## The one-paragraph mental model

A Python pipeline (GitHub Actions cron) pulls **facts** from four free APIs —
Wikipedia (history), Deezer (music), Sleeper/ESPN (sports), TMDB (screen) — and dumps
them as raw JSONL (bronze). A **dbt Core + DuckDB** project cleans and tests them into
a question-bank mart (silver→gold), the **question forge** derives typed questions
(clue / year_guess / multiple_choice / higher_lower) with difficulty scores and
distractors, and everything is upserted into **Supabase**. The Next.js frontend reads
anon/read-only and renders four game *rooms* — Board, Clock, Wedges, Streak — each a
thin renderer over the same bank. With no Supabase env vars the app silently falls
back to a committed seed bank, so the repo is playable from `git clone`.

```
SOURCES              PIPELINE (Python, Actions cron)        TRANSFORM            SUPABASE         FRONTEND (Next.js)
─────────            ───────────────────────────────        ─────────            ────────         ─────────────────
Wikipedia  ─┐        wikipedia_ingest ─┐                                          facts      ┐
Deezer     ─┤        music_ingest     ─┼─► data/raw/*.jsonl ─► dbt+DuckDB ─┐      questions  ├─► anon read ─► 4 rooms
Sleeper    ─┤        sports_ingest    ─┤      (bronze)        stg → marts  │      daily_sets ┘    /board  /clock
ESPN       ─┤        (ESPN enrich)     │                      + tests      │                      /wedges /streak
TMDB       ─┘        screen_ingest    ─┘                     (silver/gold) │           ▲               │
                                                                           │           │               ▼
                     question_forge  ◄─────────────────────────────────────┘           │         seed bank JSON
                     (facts → typed questions, distractors, difficulty) ──► upsert ────┘         (offline fallback,
                     export_seed ──► frontend/public/seed-questions.json ────────────────────►   committed)
```

## Core abstractions (the design hinges on these three)

### 1. `Fact` — the atomic unit (never scrape questions, scrape facts)
```
{ source, category, subject, fact_text, year?, numeric_value?, numeric_unit?,
  image_url?, source_url, popularity?, meta }
```
Stored in `facts`, hash-keyed for idempotent upserts. Every downstream question keeps
a foreign key here — provenance in one click.

### 2. `QuestionForge` — fact(s) → typed question
```
forge(facts) -> [{ qtype, category, difficulty 1-5, prompt, correct, choices?,
                   year?, value_a/value_b?, image_url?, fact_id }]
```
Recipes per qtype live in `pipeline/question_forge.py`. Distractors come from
**sibling sampling** (same category, same field, ±1 difficulty band). Difficulty is
the percentile of the source popularity signal within its category.

### 3. `Room` — a frontend renderer over a question query
Each room = one route + one query in `lib/queries.ts` (`questionsByType`,
`dailyBoard`, …). Rooms hold game state client-side (localStorage); they never write
to the DB. Adding a game touches zero pipeline code.

## The medallion layout (the deliberate skill-building layer)

| Layer | Where | What |
|---|---|---|
| Bronze | `data/raw/*.jsonl` (CI artifact) | raw API payload slices, append-only |
| Silver | `transform/models/staging/` | typed/renamed/deduped staging views |
| Gold | `transform/models/marts/` | `mart_question_bank`, `mart_category_stats` |
| Tests | `transform/models/**/schema.yml` | not_null / unique / accepted_values |

`dbt build` runs in the Actions workflow between extract and publish; failures block
the publish step — tests are a real gate, not decoration. See
`RESEARCH_DATA_PLATFORM.md` for why dbt+DuckDB and the Databricks Phase-2 plan.

## Pipeline scripts (house conventions: argparse, tenacity, rich, dotenv, idempotent)

| Script | Source → Output |
|---|---|
| `wikipedia_ingest.py` | On This Day + random summaries → `data/raw/wikipedia.jsonl` + `facts` |
| `music_ingest.py` | Deezer charts/artists/albums → `data/raw/deezer.jsonl` + `facts` |
| `sports_ingest.py` | Sleeper players/trending, ESPN teams → `data/raw/sports.jsonl` + `facts` |
| `screen_ingest.py` | TMDB trending/top movies & TV → `data/raw/tmdb.jsonl` + `facts` |
| `question_forge.py` | `facts` → `questions` (+ `daily_sets` board for today) |
| `export_seed.py` | `questions` → `frontend/public/seed-questions.json` |
| `selftest.py` | offline sanity checks of forge recipes + seed bank shape |

## Conventions inherited from the other repos

- Frontend: App Router, Server Components by default, `"use client"` only for game
  interactivity; Tailwind + Framer Motion; `prefers-reduced-motion` respected.
- All Supabase access through `lib/supabase.ts` + `lib/queries.ts`; the client is
  **null-safe** — no env vars ⇒ seed-bank offline mode, never a crash.
- Service-role key = pipeline only. Anon key = frontend reads, enforced by RLS
  (every table: RLS on + public-read policy).
- Migrations in `db/migrations/`, timestamp-prefixed; `db/schema.sql` is the full
  current picture.
- Secrets via `.env` (never committed) locally, repo secrets in Actions.
