# File Index

Annotated map of the repository, for fast navigation. Paths are relative to repo
root. Keep this current as v2 phases add/rename files.

## Top level

| Path | Purpose |
|---|---|
| `README.md` | Project overview, rooms table, quick start, pipeline + setup |
| `CLAUDE.md` | Instructions for Claude Code working in this repo |
| `CHANGELOG.md` | Version policy (1.0.0 frozen, 2.x.x per phase) + history |
| `LICENSE` | MIT license |
| `vercel.json` | Vercel config: cache headers (1y immutable images), security headers |
| `.env.example` | Env template (DATABASE_URL, TMDB_API_KEY, NEXT_PUBLIC_SUPABASE_*) |
| `.logo/` | Brand assets — "Logo V10 - Secret Order" (svg/png/jpg): engraved gold spade + all-seeing eye + candle + glyph ring on oxblood |
| `frontend/` | Next.js 15 App Router app (the serving path) |
| `pipeline/` | Python ETL scripts (GitHub Actions cron) |
| `transform/` | dbt Core + DuckDB project (bronze → silver → gold) |
| `db/` | Postgres schema + migrations |
| `data/` | Bronze JSONL layer (committed; the database in DB-less mode) |
| `databricks/` | Phase-2 Delta Lake mirror lab (research, NOT the serving path) |
| `supabase/` | Supabase migrations/config (optional live-DB mode) |
| `docs/` | Documentation (this folder; v2 canonical, archive = v1) |
| `.github/workflows/` | CI: `etl_daily.yml`, `wiki_hard.yml` |

## `frontend/app/` — routes (Server Component `page.tsx` → client `*Game.tsx`)

| Route | Game | Notes |
|---|---|---|
| `/` | home | `page.tsx`: hero + Marquee + RoomCard grid (→ card deck in 2.2) |
| `/board` | Jeopardy board | 5×5 clues, daily double |
| `/clock` | "when did it happen" | year-slider, distance-scored |
| `/wedges` | Trivial-Pursuit wedges | 6 wedges, quickfire |
| `/streak` | higher/lower | comparison chain |
| `/map` | GeoGuessr-style | pin on `WorldMap`, km-scored |
| `/daily` | daily gauntlet | one round per room (→ "The Gauntlet" in 2.12) |
| `/thread` | linked-clue chain | each answer feeds the next |
| `/seance` | "who/what am I" | progressive costly clues (full redo in 2.9) |
| `/ladder` | closest-match | magnitude/region hints (full redo in 2.10) |
| `/mystery` | daily deterministic case | WHO/WHERE/WHEN (crown jewel, 2.11) |
| `/profile` | player dashboard | XP, accuracy, streak, achievements (localStorage) |
| `/jukebox` `/gallery` `/blitz` `/connections` `/lobby` | **legacy** | folded into keepers in v2 (see GAMES.md) |
| `layout.tsx` | root layout | metadata, Cinzel font, global shell |
| `globals.css` | global styles | dark palette, noise, candle/flicker/flip keyframes |

## `frontend/components/`

| File | Purpose |
|---|---|
| `RoomShell.tsx` | Brass doorway frame, category suit, nameplate, back link (wraps each game) |
| `RoomCard.tsx` | Home-page game card (→ unique playing card in 2.2) |
| `Marquee.tsx` | Infinite scrolling fact ticker |
| `WorldMap.tsx` | Offline SVG world map (lazy `world-atlas` topojson, equirectangular) — stray-line fix in 2.7 |
| `GoogleMap.tsx` | Optional Google Maps alternative for the Map room |
| `Confetti.tsx` | Canvas particle burst |
| `SoundToggle.tsx` | Persistent mute toggle |
| `LeaderboardPanel.tsx` | Score submit + top-scores list (Supabase Edge Fn or local) |
| `AchievementToast.tsx` | "achievement unlocked" toasts |
| `PracticeBar.tsx`, `RoomFilters.tsx` | Deck + difficulty filters |
| `ProfileDashboard.tsx` | Activity heatmap, XP, per-room/category stats |
| `BoardGame` `ClockGame` `WedgesGame` `StreakGame` `MapGame` `DailyGame` `ThreadGame` `SeanceGame` `LadderGame` `MysteryGame` | The ten keeper game clients |
| `BlitzGame` `ConnectionsGame` `JukeboxGame` `GalleryGame` `LobbyGame` | Legacy clients (folded in v2) |
| `Mystery*` (`Intro`, `Investigate`, `Verdict`, `AlibiTracker`, `RelationshipMap`, `MapView`, `EvidenceLog`, `CharacterTooltip`, `StatusPill`, `AccusationForm`, `TimelinePanel`) | Mystery subcomponents — simplified/collapsed in 2.11 |

## `frontend/lib/`

| File | Purpose |
|---|---|
| `queries.ts` | ALL data access; Neon (`db.ts`) first, silent seed-bank fallback |
| `types.ts` | `Category`, `QType`, `Question`, `CATEGORY_HEX` palette (single source) |
| `db.ts` | Neon serverless client (read-only, server-only); null-safe |
| `supabase.ts` | Supabase anon client (read-only); null-safe |
| `rng.ts` | Date-seeded PRNG (`mulberry32`, `daySeed`, `shuffled`, `pickRotating`) — SSR/client consistency; extended for Wedges shared order in 2.5 |
| `geo.ts` | Map geometry: project/unproject, `haversineKm`, `mapPoints` scoring |
| `sound.ts` | Web-Audio synthesis (no asset files), mute state |
| `fuzzy.ts` | Liberal free-text answer matching (Levenshtein + substring) |
| `haptics.ts` | `navigator.vibrate` wrapper |
| `decks.ts` | Themed question-filter decks |
| `profile.ts` | Player progression (localStorage): XP, levels, streak, achievements |
| `leaderboard.ts` | Global leaderboard (Edge Fn or local fallback) |
| `lobby.ts` | Multiplayer game state (legacy) |
| `mystery.ts` | Daily case generation (pure fn of date): roster, rooms, hours, `generateCase`, `verifySolvable`, `deduceCulprits`, `deductionMatrix` |
| `mysteryScore.ts` | Mystery scoring + share text |
| `mysteryEnrich.ts`, `mysteryTypes.ts`, `mysterySupabase.ts` | Mystery enrichment, types, isolated client |
| `mystery.test.ts`, `mysteryScore.test.ts` | Vitest suites (solvability, scoring) |
| `usePractice.ts` | Practice-mode hook |

## `frontend/public/`

| File | Purpose |
|---|---|
| `seed-questions.json` | Committed offline question bank (the default serving layer) |
| `logo-256.png` `logo-512.png` `logo-96.png` `icon.png` `apple-touch-icon.png` | Logo/icon renders |
| `mansion-map.jpg` | Overhead mansion layout for the Mystery room |

## `frontend/` config

`package.json` (Next 15.5, framer-motion, tailwind 3.4, world-atlas, topojson,
supabase-js; scripts: dev/build/analyze/start/lint/test) · `next.config.mjs`
(remote image patterns: wikimedia, dzcdn, tmdb, espn, flagcdn) ·
`tailwind.config.ts` (palette tokens + category jewels + animations + safelist) ·
`tsconfig.json` · `vitest.config.ts`.

## `pipeline/`

| File | Purpose | External API / auth |
|---|---|---|
| `common.py` | Shared infra: rate-limited session, `get_json` (tenacity, 8 retries), bronze `dump_raw`/`compact_jsonl`, `get_db` (psycopg2, null-safe), `upsert_*` | — |
| `question_forge.py` | THE core: facts → 7 typed-question recipes + deterministic daily board | — |
| `selftest.py` | Offline CI gate (`--core-only` pre-ingest, full at publish) | — |
| `export_seed.py` | Export freshest bank → `frontend/public/seed-questions.json` (safety gates) | — |
| `wikipedia_ingest.py` | On-This-Day + random + hard sweeps | Wikipedia REST/MediaWiki/Wikidata/DBpedia (no auth) |
| `music_ingest.py` | Charts + albums → music facts | Deezer (no auth) |
| `sports_ingest.py` | Trending players + NFL teams | Sleeper + ESPN (no auth) |
| `geo_ingest.py` | Countries → geography + map pins | restcountries GitHub mirror (no auth, ETag-cached) |
| `screen_ingest.py` | Movies → screen facts | TMDB (`TMDB_API_KEY`; skipped if unset) |
| `requirements.txt` | requests, psycopg2-binary, tenacity, rich, dotenv, slugify, dbt-core, dbt-duckdb | — |

## `transform/` (dbt + DuckDB)

`dbt_project.yml`, `profiles.yml` (committed, no secrets) ·
`models/staging/stg_facts.sql` (silver: read bronze JSONL, type, dedupe by
content_hash) + `schema.yml` (tests) · `models/marts/mart_question_bank.sql` (gold:
difficulty pre-scored) · `mart_category_stats.sql` (health) + `schema.yml`. Tests
gate the publish.

## `db/`

`schema.sql` — tables `facts`, `questions`, `daily_sets`, `scores`; enums `source`,
`category` (6), `qtype` (10), `mode` (6); RLS public-read. `migrations/` —
timestamp-prefixed.

## `data/`

`raw/*.jsonl` — bronze layer, committed, compacted by `content_hash`. Present:
`wikipedia.jsonl`, `geography.jsonl` (others appear as ingests run). `cache/` —
ingest caches (e.g. Sleeper player dict).

## `.github/workflows/`

`etl_daily.yml` — nightly DAG extract → transform/test → publish (cron 09:20 UTC);
**fixed in Phase 2.1**. `wiki_hard.yml` — 6-hourly hard-question sweep; both push to
`main` (the push-race fixed in 2.1).
