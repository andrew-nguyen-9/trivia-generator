# Phase 3 — Build-out plan ("more rooms, more juice")

Scope approved 2026-06-13: **all four new rooms**, **all four dynamic-UI layers**,
and a **global leaderboard** (Supabase Edge Function write-path, with a localStorage
fallback so it still works DB-less). Hard constraint from the user: *no new APIs* —
every new room draws on the four sources already wired (Wikipedia, Deezer,
Sleeper/ESPN, TMDB, restcountries), capturing fields already present in their
responses. The app must stay **playable-from-clone**: new media (audio, images)
are online enhancements that degrade gracefully; the offline seed demonstrates
every room without network.

## New rooms (each a thin renderer over the one fact bank)

| Room | Route | qtype | Offline fuel | Live fuel (existing sources) |
|---|---|---|---|---|
| **The Jukebox** | `/jukebox` | `audio_guess` | synthesized melodies (Web Audio, no files) | Deezer 30s `preview` URLs |
| **The Gallery** | `/gallery` | `image_guess` | country flags (flagcdn, stable) + landmark images | TMDB poster/backdrop paths |
| **The Blitz** | `/blitz` | reuses `multiple_choice` | existing MC bank | — |
| **The Connections** | `/connections` | `connections` | hand-curated 4×4 groups | forged from MC answer siblings |

- **Jukebox**: a waveform/scrubber player. Offline it plays famous public-domain
  melodies note-by-note via an oscillator (`lib/sound.ts` `playMelody`); online the
  pipeline attaches Deezer preview URLs and it streams the clip. Guess from 4 choices.
- **Gallery**: progressive-blur reveal — the image starts heavily blurred and
  sharpens over a few seconds (or on demand), rewarding an early correct guess.
- **Blitz**: 60-second sprint over MC; combo multiplier, ticking clock, screen
  shake on a miss, escalating speed. Pure adrenaline, zero new data.
- **Connections**: NYT-style — 16 tiles, find the four hidden groups; four mistakes
  ends it. Date-seeded for a shared daily puzzle.

## Dynamic-UI layers (cross-cutting)

1. **Sound & juice** — `lib/sound.ts` (Web Audio, synthesized SFX so no asset files
   ship → stays offline): tick, correct, wrong, win, melody. Global mute persisted
   to localStorage + a `SoundToggle`. `components/Confetti.tsx` canvas burst on wins.
   `lib/haptics.ts` `navigator.vibrate`. Combo meters / screen-shake utilities.
2. **Profile & progression** — `lib/profile.ts`: every room records a result; XP,
   levels, and unlockable achievement badges derive from the aggregate. `/profile`
   dashboard: games played, best scores, accuracy by category, a daily-streak
   calendar heatmap. All localStorage (frontend stays read-only against the DB).
3. **Motion & transitions** — richer Framer choreography on home + rooms; a
   page-curtain transition wrapper; staggered reveals.
4. **Decks & difficulty** — `lib/decks.ts` themed decks (e.g. "World Capitals",
   "90s Movies Night") that filter the bank; per-room difficulty selector;
   keyboard-first controls.

## Global leaderboard (sanctioned write-path)

- `supabase/functions/submit-score/` — Deno Edge Function; validates + rate-limits
  + writes with the service role *inside the function*, so the anon client never
  writes directly (preserves the house rule). Reads come through a public view.
- `lib/leaderboard.ts` — null-safe: posts to the function when
  `NEXT_PUBLIC_SUPABASE_URL` is set; otherwise keeps a **local** top-10 per room in
  localStorage. Same auto-upgrade pattern as the rest of the app.
- `db/migrations/` — `scores` table (RLS: public read, no anon insert) + the view.

## Pipeline changes (no new APIs)

- `music_ingest.py` — also capture Deezer track `preview` → `meta.preview_url`.
- `screen_ingest.py` — capture `poster_path` → `image_url` (TMDB CDN).
- `geo_ingest.py` — capture `flags.png` → `image_url` for flag questions.
- `question_forge.py` — new recipes: `forge_audio_guess`, `forge_image_guess`,
  `forge_connections`. `selftest.py` gains checks for each. `export_seed.py` FIELDS
  grows `audio_url`, `melody`, `groups`. `db/schema.sql` qtype enum + columns.

## Build order

1. Foundation libs (sound, haptics, profile, decks, leaderboard, confetti, toggle).
2. `types.ts` new qtypes + fields.
3. Pipeline recipes + selftest + seed-bank curation (rooms work offline first).
4. The four rooms + routes + home cards.
5. Profile dashboard.
6. Leaderboard edge function + wiring.
7. Apply juice to existing rooms; motion polish; deck/difficulty pickers.
8. Verify (`tsc`, `next build`, `selftest`, `dbt build`) green; commit per phase.
