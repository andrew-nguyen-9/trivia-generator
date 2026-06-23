# Changelog

All notable changes to PARLOR are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org/). The running version is `frontend/package.json`.

## Versioning policy

- **v1.0.0** — the app as shipped before the v2 era. Frozen baseline; tag `v1.0.0`.
- **v2.x.x** — the new era. **One minor version per phase** (2.1, 2.2, … 2.19),
  patches for fixes within a phase. v2 work happens on the `v2` integration branch
  via per-phase sub-branches (`phase/2.N-<slug>`); when every phase has landed, `v2`
  merges to `main` and tags **`v2.0.0`**. See `docs/v2/ROADMAP.md`.

## [Unreleased] — v2

The v2 framework is documented in `docs/v2/`. Phases, in order:

- 2.1 Pipeline Resurrection · 2.2 Brand + Design System + Card-Deck Home ·
  2.3 Board · 2.4 Clock · 2.5 Wedges · 2.6 Streak · 2.7 Map · 2.8 Thread ·
  2.9 Séance (redo) · 2.10 Ladder (redo) · 2.11 Mystery (crown jewel) ·
  2.12 Gauntlet · 2.13 SEO · 2.14 Accessibility · 2.15 Light/Dark ·
  2.16 Performance · 2.17 Mobile · 2.18 Cross-Browser · 2.19 Site Pages.

### 2.0.0 — Documentation framework (this branch)
- Established the v2 documentation framework under `docs/v2/`.
- Archived v1.0.0 docs to `docs/archive/`.
- Added this changelog + versioning policy.

## [1.0.0] — baseline (the shipped app)

The pre-v2 application, preserved as the v1 baseline.

- **Ten game rooms**: Board, Clock, Wedges, Streak, Map, Daily, Thread, Séance,
  Ladder, Mystery (plus legacy Jukebox, Gallery, Blitz, Connections, and a
  multiplayer Lobby; a `/profile` XP/achievements dashboard).
- **Nightly pipeline**: Python ETL on GitHub Actions (`etl_daily.yml`) forging a
  question bank from Wikipedia, Deezer, Sleeper/ESPN, TMDB, restcountries; bronze
  JSONL committed to the repo.
- **Transform**: dbt Core + DuckDB (bronze → staging → marts) with schema tests
  gating publish.
- **Frontend**: Next.js 15 App Router, Tailwind, Framer Motion; fully playable
  offline from the committed `frontend/public/seed-questions.json` seed bank, with
  optional live Neon/Supabase upgrade.
