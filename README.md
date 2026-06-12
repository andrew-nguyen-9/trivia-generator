# PARLOR — an after-dark house of trivia games

Four trivia rooms over one question bank, forged nightly from **Wikipedia**,
**Deezer**, **Sleeper/ESPN**, and **TMDB**. Third project in the family after
[fantasy-football-tool](https://github.com/andrew-nguyen-9/fantasy-football-tool)
and [music-festival-analyzer](https://github.com/andrew-nguyen-9/music-festival-analyzer),
sharing their architecture: Python ETL on GitHub Actions → Supabase → read-only
Next.js — plus a new **dbt Core + DuckDB** transform layer (see
`docs/RESEARCH_DATA_PLATFORM.md` for the why).

## The rooms

| Room | Route | Game | Inspired by |
|---|---|---|---|
| The Board | `/board` | category board, $200–$1000 clues, daily double, same board for everyone each day | Jeopardy |
| The Clock | `/clock` | drag a year slider, score by distance | WhenTaken |
| The Wedges | `/wedges` | fill six category wedges in 20 quickfire questions | Trivial Pursuit |
| The Streak | `/streak` | higher/lower on real metrics, one miss ends the run | The Higher Lower Game |

## Quick start (zero backend needed)

```bash
cd frontend
npm install
npm run dev          # playable immediately on the committed seed bank
```

With no Supabase env vars the app runs in **house-deck mode** off
`frontend/public/seed-questions.json`. Set `NEXT_PUBLIC_SUPABASE_URL` +
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and it reads the live bank instead.

## Pipeline (facts in, questions out)

```bash
cd pipeline
pip install -r requirements.txt
cp ../.env.example .env            # fill in keys

python wikipedia_ingest.py         # On This Day + random sweeps → history/wildcard
python music_ingest.py             # Deezer charts → music
python sports_ingest.py            # Sleeper trending + ESPN teams → sports
python screen_ingest.py            # TMDB movies → screen (needs TMDB_API_KEY)
python question_forge.py           # facts → typed questions + today's board
python export_seed.py              # refresh the offline seed bank
python selftest.py                 # offline sanity checks (no network needed)
```

Each ingest also appends to `data/raw/*.jsonl` — the **bronze layer**. The dbt
project in `transform/` builds the silver/gold layers with schema tests:

```bash
cd transform
dbt build --profiles-dir .         # staging views + marts + tests on DuckDB
```

`.github/workflows/etl_daily.yml` runs the whole DAG daily
(extract → transform/test → publish); dbt test failures block the publish.

## Setup

1. Create a Supabase project → run `db/schema.sql` in the SQL editor.
2. Repo secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY`.
3. Deploy `frontend/` to Vercel with the two `NEXT_PUBLIC_SUPABASE_*` vars.

## Docs

| Doc | Contents |
|---|---|
| `docs/RESEARCH_TRIVIA_SOURCES.md` | trivia-source survey + the fact→question forge design |
| `docs/RESEARCH_DATA_PLATFORM.md` | Databricks / dbt / Snowflake / BigQuery comparison + skill-building roadmap |
| `docs/GAME_MODES.md` | room designs, scoring, Phase-2 rooms (map, jukebox, daily, multiplayer) |
| `docs/ARCHITECTURE.md` | the full system picture |
| `docs/UI_SPEC.md` | design tokens, signature components, motion rules |

Data credits: Wikipedia (CC BY-SA), Deezer API, Sleeper API, ESPN, TMDB
(this product uses the TMDB API but is not endorsed or certified by TMDB).
