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

## [2.0.0] — 2026-06-24 — the v2 era

All v2 phases landed on the `v2` integration branch and merged to `main`. The
per-phase `2.x` numbers below were the dev-time convention; the shipped release
is **`v2.0.0`** (`frontend/package.json` reconciled 2.2.2 → 2.0.0 to match the
release tag). The v2 framework is documented in `docs/v2/`. Phases, in order:

- 2.1 Pipeline Resurrection · 2.2 Brand + Design System + Card-Deck Home ·
  2.3 Board · 2.4 Clock · 2.5 Wedges · 2.6 Streak · 2.7 Map · 2.8 Thread ·
  2.9 Séance (redo) · 2.10 Ladder (redo) · 2.11 Mystery (crown jewel) ·
  2.12 Gauntlet · 2.13 SEO · 2.14 Accessibility · 2.15 Light/Dark ·
  2.16 Performance · 2.17 Mobile · 2.18 Cross-Browser · 2.19 Site Pages ·
  2.20 Gap-fill · 2.21 UI/UX a11y · 2.22 Bundle optimization · 2.23 Code review.

### 2.20–2.23 — final hardening batch
- **2.20 Gap-fill** — The Gauntlet was reachable only through the
  `/daily`→`/gauntlet` redirect across the sitemap, JSON-LD, home deck, and
  footer; repointed the route registry + nav at the real `/gauntlet` (200) and
  gave it per-route metadata. Pinned `next.config` `outputFileTracingRoot` (a
  stray parent-dir lockfile was failing the build-trace step with ENOENT).
- **Pipeline** — back-seeded the silently-starved music + sports sources
  (Deezer + Sleeper/ESPN had never committed bronze while the pipeline was
  frozen); seed bank 475 → 561 (music 5→141, sports 0→85). Ignored the 15 MB
  Sleeper player cache. (Screen/TMDB still gated on a missing `TMDB_API_KEY`.)
- **2.21 UI/UX** — Board tiles carry an `aria-label` of "<category>, $<value>"
  (were 25 indistinguishable "$200"); the question modal is a proper
  `role=dialog` with `aria-modal` + `aria-labelledby` and moves focus on open;
  the shared practice panel got dialog semantics + Escape-to-close.
- **2.22 Optimization** — `/board` First Load JS **291 KB → 217 KB** (−74 KB):
  it was bundling the 232 KB seed bank into the client. Extracted the pure
  `buildBoardColumns` to seed-free `lib/board.ts`.
- **2.23 Code review** — correctness pass clean; removed one dead import.

### 2.2.2 — Real seal + the living deck
- **The real Secret Order seal everywhere**: regenerated every logo/favicon asset
  (hero, card back, room headers, `icon.png`, apple-touch, OG) from `.logo/` — the
  detailed engraved gold seal, transparent-cut. No more white silhouette.
- **The deck is now a deck**: a stacked carousel (cycle the top card to the bottom)
  that **fans out** on demand; pick a card to **pull it out and zoom** it (portalled
  overlay) with an Enter button. Mystery is the Ace.
- **Pips scale with rank**: fewer pips render larger; the Ace gets one grand central
  emblem in a gilt ring; corner indices read like real cards (bottom-right reversed).
- **Gold is one cursor-driven light** — removed the static sheen; a single global
  highlight follows the pointer across all gilt.
- More ornate fronts (double gold frame, corner filigree) and backs (denser damask,
  gilt ring, the seal).

### 2.2.1 — Card aesthetic
- Game cards are now real playing cards: a **parchment front** with corner indices
  (rank + suit) and the game's **gold emblem multiplied into canonical pips** by its
  rank (Ace = the Mystery feature), and an **ornate back** — the seal on an
  intricate gold-on-oxblood cross-hatch pattern, revealed on flip.
- New `GoldSheen` tracks the pointer and drives a cursor-reactive highlight across
  **all gilt on the page** (title, emblems, pips); rAF-throttled, off under
  reduced-motion.
- Re-themed each game's emblem to match its mechanic (clock face, six-sided wedge,
  higher/lower arrows, drop-pin, rungs, …).

### 2.2.0 — Brand + Design System + Card-Deck Home
- Reframed the brand from "after-dark" to **the Secret Order** (mystery/intrigue):
  README title, home hero copy, and the GitHub repo description.
- Rebuilt the home as a **deck of unique cards** (`CardDeck` + `GameCard`): one
  engraved card per game (suit + Secret Order character + emblem), the Mystery as
  a feature showpiece, with card-trick motion — deal-in stagger, flip-on-hover/focus,
  and a shuffle that re-deals via layout animation.
- Reduced-motion path: static, flat cards, no flip or perpetual motion (2.14 stub).
- Codified the seal's motif vocabulary as namespaced `deck-*` card-face CSS; retired
  the old `RoomCard`.

### 2.1.0 — Pipeline Resurrection
- Shared `bank-writer` concurrency group across `etl_daily.yml` + `wiki_hard.yml`
  and `git pull --rebase` before push — kills the silent push-race.
- Job-level `permissions: contents: write` on the publishing jobs.
- `if: failure()` observability: opens/updates a `pipeline-failure` GitHub issue.
- Health gate: `question_forge.py --min-questions 100` floor + a category-spread
  gate in transform; real failures (`export_seed.py` refusals, dbt tests) stay red.
- Hardened the `wiki_hard` dispatch `count` input against shell injection.
- Runbook + as-built knobs documented in `docs/v2/PLATFORM.md §2.1`.

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
