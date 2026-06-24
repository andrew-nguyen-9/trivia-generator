# PARLOR v3 — Ideas

Direction ideas for the era after `v2.0.0`. This is a **menu, not a plan** — raw
material for a future brainstorm/roadmap, deliberately wider than what will ship.
Grounded in the v2 codebase as it actually stands (see `docs/v2/` for the v2
framework and `docs/FILE_INDEX.md` for the map).

## Where v2 left off

v2 shipped ten rooms over a nightly-forged question bank, a full Secret Order
brand, accessibility/theme/perf/mobile/cross-browser hardening, two server-side
daily logic puzzles (Séance, Ladder), and a Mystery hub. The app is fully
playable offline from the committed seed bank; the pipeline accumulates bronze
nightly. It is single-player, anonymous, and localStorage-only by design
(the frontend never writes the DB).

## Debts carried out of v2 (clear before chasing new scope)

These are known and documented, not discoveries — start here.

1. **Screen/TMDB starvation.** `screen_ingest.py` is gated on `TMDB_API_KEY`;
   with no key it never runs and the `screen` category sits at ~2 questions, so
   the Gallery room and any screen clue run near-empty. Either provision the key
   in CI or replace TMDB with a keyless screen source (Wikidata film/TV SPARQL,
   OMDb-free tier). See `docs/v2/PLATFORM.md` "Source health".
2. **Live-env gates never run.** 2.16 Lighthouse before/after, 2.17 playwright
   mobile sweep, 2.18 playwright multi-engine, and an axe a11y pass all need a
   running deployment. They were deferred across the v2 batch. v3 should stand up
   a preview deploy and actually run them — the code is ready, the evidence isn't.
3. **Per-source health floor.** The nightly only enforces a *total* question
   floor (`--min-questions`), which one healthy source (history) clears alone — a
   single dead source decays silently. Add a per-(source/category) floor to the
   health gate so the next starvation pages someone instead of rotting quietly.
4. **Legacy rooms still shipped.** Jukebox, Gallery, Blitz, Connections, Lobby
   remain as full routes in `lib/rooms.ts` though v2's ROADMAP framed them as
   "folded." Decide: promote to first-class (give them the 2.x refurb treatment)
   or retire them. Right now they're in the sitemap and deck but un-refurbished.

## Idea tracks

### A. Make it social (the biggest lever)

The product is single-player; the Lobby is a stub. Trivia's natural growth loop
is comparison and competition.

- **Async daily leaderboards** — every daily room already produces a deterministic
  per-date result (`lib/rng.ts` day-seed). Add an opt-in score post (this is the
  first time the frontend would write the DB — needs a write path + abuse
  controls, or an edge function, since "frontend never writes the DB" is a v2
  invariant to consciously break, not drift past).
- **Share cards** — the Gauntlet already teases "share your line of squares"
  (Wordle-style emoji grid). Generate an OG image per result (`@vercel/og`) so a
  shared link previews the actual run. Cheap, viral, no account needed.
- **Private rooms / pass-and-play** — a real multiplayer Lobby: one host seeds a
  room code, players join, everyone plays the same daily set, results compared at
  the end. Start pass-and-play (zero infra) before realtime.
- **Realtime head-to-head** — only if async proves demand. Vercel + a presence
  layer; scope-creep risk is high, gate it behind evidence.

### B. Deepen the content engine

- **More keyless sources.** Wikidata SPARQL is the underused giant — structured
  facts for music, film, sports, science, art with stable IDs and no key. Could
  backfill screen and broaden every category. openTDB, MusicBrainz, and the Met
  Open Access API are other keyless candidates.
- **Question quality scoring.** The forge emits typed questions but doesn't rank
  them. Add a quality/ambiguity score (LLM-judge or heuristic) so the board picks
  *good* clues, not just difficulty-tiered ones. The Databricks Phase-2 lab
  (`databricks/`) is the natural home for an offline quality model.
- **Difficulty calibration from play data.** If scores get posted (track A),
  feed real answer rates back into `difficulty` — a clue everyone gets is a $200,
  one nobody gets is a $1000. Closes the loop the static tiers only guess at.
- **Themed daily sets.** The Board already has a daily theme reskin
  (`lib/themes.ts`); extend the idea — a fully themed cross-room day (a "music
  night", a "1969" day) where every room pulls from one motif.

### C. Personalization without accounts

- **Per-player weak-spot practice.** Practice mode + the profile already track
  saved questions and achievements in localStorage. Surface "your weakest
  category" and route practice there.
- **Streaks and a reason to return.** Profile has streak scaffolding; make the
  daily a genuine habit loop (calendar of completed days, a grimoire-style
  collection that fills in). The Séance's `lib/grimoire.ts` already models this —
  generalize it across rooms.

### D. New mechanics / rooms

- **A weekly "hard mode" Mystery** — the Mystery is the crown jewel; a longer,
  multi-day case with cross-room clues would deepen the canon hub.
- **A drafting/deckbuilding meta** — lean into the card-deck identity: collect
  card faces, build a "hand" that modifies play. Risky (could dilute the trivia),
  but it's the most on-brand growth direction.
- **Audio-first room** — the Jukebox hints at it; a real "name the intro" room if
  a keyless audio-clip source exists (Deezer 30s previews already ingested).

### E. Platform / infra

- **Stand up the preview deploy** so the deferred QA gates (debt #2) can run, and
  wire Lighthouse CI as a budget gate on PRs.
- **Reconsider the seed-bank-in-repo model at scale.** Committing
  `seed-questions.json` (now ~230 KB) and bronze JSONL works as a DB-less
  fallback, but as the bank grows this bloats the repo and every clone. A
  threshold where the seed becomes a fetched artifact (still offline-capable via a
  build-time copy) may be worth it. Don't do it early — it's a real tradeoff
  against the "repo is the database" simplicity that makes the app zero-config.
- **Edge-cache the daily reads.** Séance/Ladder are dynamic Neon reads per
  request but deterministic per date — a per-day cache key would cut DB load to
  one read per puzzle per day.

## First-principles cut

If only one thing: **track A's share cards + async leaderboards.** The daily
determinism is already built, the content engine is healthy, and the single
missing ingredient for growth is a reason to come back and a reason to tell a
friend. Everything else (more sources, new mechanics, realtime) is depth on a
product that first needs a loop. Clear the v2 debts (especially the live QA
gates and TMDB) as the price of entry, then build the social loop.

> Open this with `superpowers:brainstorming` before committing to a v3 roadmap —
> this doc is intentionally a superset.
