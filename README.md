# PARLOR — an after-dark house of trivia games

Ten trivia rooms over one question bank, forged nightly from **Wikipedia**,
**Deezer**, **Sleeper/ESPN**, and **TMDB**. Third project in the family after
[fantasy-football-tool](https://github.com/andrew-nguyen-9/fantasy-football-tool)
and [music-festival-analyzer](https://github.com/andrew-nguyen-9/music-festival-analyzer),
sharing their architecture: Python ETL on GitHub Actions → Supabase → read-only
Next.js — plus a new **dbt Core + DuckDB** transform layer (see
`docs/RESEARCH_DATA_PLATFORM.md` for the why).

Every room shares a dynamic layer: synthesized Web-Audio sound effects (no asset
files — stays offline), confetti, haptics, an XP/achievements **profile** at
`/profile`, and a global **leaderboard** (the sanctioned Supabase Edge Function
write-path, with a local fallback so it works with no backend).

## The rooms

| Room | Route | Game | Inspired by |
|---|---|---|---|
| The Board | `/board` | category board, $200–$1000 clues, daily double; easy (multiple-choice) or hard (free-text) | Jeopardy |
| The Clock | `/clock` | drag a year slider, score by distance, optional decade hint | WhenTaken |
| The Wedges | `/wedges` | fill six category wedges in 20 quickfire questions | Trivial Pursuit |
| The Streak | `/streak` | higher/lower on real metrics, one miss ends the run | The Higher Lower Game |
| The Map | `/map` | pin facts on a satellite Google map (or the offline SVG atlas), scored by the km | GeoGuessr |
| The Jukebox | `/jukebox` | name that tune — offline synthesized melodies or Deezer previews | name-that-tune |
| The Gallery | `/gallery` | name the flag/poster/place as it sharpens from a blur | visual quiz |
| The Blitz | `/blitz` | 60-second multiple-choice sprint, combos buy time; keys 1–4; deck + difficulty | speed quiz |
| The Connections | `/connections` | sort 16 tiles into 4 hidden groups, four mistakes | NYT Connections |
| The Daily | `/daily` | one round from every room, daily, shareable emoji result | Wordle's daily loop |

## Quick start (zero backend needed)

```bash
cd frontend
npm install
npm run dev          # playable immediately on the committed seed bank
```

With no Supabase env vars the app serves `frontend/public/seed-questions.json` —
which the nightly pipeline **refreshes and commits** (see below), so this is the
default production mode, not a demo mode. Set `NEXT_PUBLIC_SUPABASE_URL` +
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and it reads a live Supabase bank instead.

## Pipeline (facts in, questions out)

```bash
cd pipeline
pip install -r requirements.txt
cp ../.env.example .env            # fill in keys

python wikipedia_ingest.py         # On This Day + random sweeps → history/wildcard
python music_ingest.py             # Deezer charts → music
python sports_ingest.py            # Sleeper trending + ESPN teams → sports
python geo_ingest.py               # restcountries → geography (incl. map pins)
python screen_ingest.py            # TMDB movies → screen (needs TMDB_API_KEY)
python question_forge.py           # facts → typed questions + today's board
python export_seed.py              # refresh the offline seed bank
python selftest.py                 # offline sanity checks (no network needed)
```

Each ingest also appends to `data/raw/*.jsonl` — the **bronze layer**, which is
**committed to the repo** and compacted by `content_hash` (unchanged facts keep
their original lines, so nightly re-runs produce minimal diffs). In DB-less mode
the repo is the database: bronze accumulates facts, the forge derives questions
from it, and the committed seed bank is the serving layer. The dbt project in
`transform/` builds the silver/gold layers with schema tests:

```bash
cd transform
dbt build --profiles-dir .         # staging views + marts + tests on DuckDB
```

`.github/workflows/etl_daily.yml` runs the whole DAG daily
(extract → transform/test → publish); dbt test failures block the publish.

## Setup

### DB-less mode (default — zero backend accounts)

1. Repo Settings → Actions → General → Workflow permissions → **Read and write**
   (the nightly job commits bronze + the refreshed seed bank).
2. Optional repo secret: `TMDB_API_KEY` (the screen ingest is skipped without it).
3. Deploy `frontend/` to Vercel with **no env vars**. Done — the bank refreshes
   nightly via the committed seed file.

### Live-DB mode (optional upgrade, e.g. for Phase-3 multiplayer)

1. Create a Supabase project → run `db/schema.sql` + `db/migrations/*` in the SQL editor.
2. Add repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — the same
   workflow starts upserting facts/questions/daily boards automatically.
3. Add the two `NEXT_PUBLIC_SUPABASE_*` vars in Vercel to read the live bank.

## Docs

Start at [`docs/README.md`](docs/README.md). The **v2 framework** is canonical; v1
docs are archived.

| Doc | Contents |
|---|---|
| `docs/v2/ROADMAP.md` | v2 spine: every phase, deps, traceability, the Secret Order canon |
| `docs/v2/DESIGN_SYSTEM.md` | logo-derived language, card deck, light/dark, reference sites, Claude Design |
| `docs/v2/GAMES.md` | per-game refurbishment specs + legacy folding |
| `docs/v2/PLATFORM.md` | pipeline fix, SEO, a11y, perf, mobile, cross-browser, site pages |
| `docs/v2/PHASE_PROMPTS.md` | copy-paste initiation prompt per phase |
| `docs/FILE_INDEX.md` | annotated map of every dir/file |
| `CHANGELOG.md` | version policy (1.0.0 frozen, 2.x.x per phase) |
| `docs/archive/` | v1.0.0 docs (architecture, game modes, UI spec, research) |
| `databricks/README.md` | Phase-2 lab: mirror the medallion onto Databricks Free Edition |

Data credits: Wikipedia (CC BY-SA), Deezer API, Sleeper API, ESPN, TMDB
(this product uses the TMDB API but is not endorsed or certified by TMDB).
