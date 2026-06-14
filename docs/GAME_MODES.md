# Game Modes — "The Parlor" design doc

> Deliverable 3 of the project brief: *"Research into fun ways to implement this —
> a couple of fun games running on the same architecture: Jeopardy, Trivial Pursuit,
> WhenTaken, GeoGuessr, etc."*

## The unifying concept: one question bank, many rooms

The app is **PARLOR** — an after-dark house of games. Every game mode is a *room*,
and every room is a thin renderer over the same typed question bank (see
`RESEARCH_TRIVIA_SOURCES.md` § the forge). New game = new renderer, zero new data work.
This is the same "thin consumers of one value layer" idea as the fantasy tool's seven
tools over `player_value`.

```
                      questions (typed, difficulty-scored, categorized)
                         │
   ┌──────────┬──────────┼──────────────┬─────────────┐
   ▼          ▼          ▼              ▼             ▼
THE BOARD  THE CLOCK  THE WEDGES    THE STREAK    (Phase 2 rooms)
jeopardy   whentaken  triv pursuit  higher/lower  geoguessr, tune, daily
qtype:     qtype:     qtype:        qtype:
clue       year_guess multiple_choice higher_lower
```

## Room 1 — THE BOARD (Jeopardy-style) — `/board`

- 5 categories × 5 clues, values 200–1000 mapped from difficulty 1–5.
- Clues are **answer-phrased declaratives** forged from facts ("This Chicago park
  has hosted Lollapalooza since 2005"). Player answers mentally, flips the card,
  self-scores ✓/✗ (honor system, like physical play) — keeps v1 free of fuzzy
  answer matching. Typed-answer + Levenshtein matching is a listed Phase 2 upgrade.
- Daily Double: one random cell, wager UI.
- Board is deterministic per day (seeded by date) → everyone plays the same board,
  shareable score. (Wordle's most stealable mechanic.)

## Room 2 — THE CLOCK (WhenTaken-style) — `/clock`

- 5 rounds. Each round: an event/album/film with imagery where available.
- Player drags a **year slider** (1900–present, springy, big numerals).
- Score = `max(0, 100 − 2·|guess − truth|)` per round; 500 cap. Distance shown on a
  timeline reveal with the true year snapping in (the WhenTaken dopamine moment).
- Sources shine here: On This Day events, Deezer album years, TMDB release years.

## Room 3 — THE WEDGES (Trivial Pursuit-style) — `/wedges`

- Six category wedges: HISTORY, MUSIC, SPORTS, SCREEN, GEOGRAPHY, WILDCARD.
- Quickfire multiple choice; a correct answer in a category fills that wedge.
- Win = fill all six. Misses rotate you to a new random category (pressure without
  a board — distilled Pursuit). 20-question cap → "wedges filled" as the score.
- Wedge palette is the app's category color system (see UI_SPEC).

## Room 4 — THE STREAK (higher/lower) — `/streak`

- Two cards share a metric (Deezer fans, TMDB rating, NFL trending adds,
  country population). "Does B have **more or less** than A?"
- Correct → B becomes the anchor, streak++. Wrong → run ends. Best streak persisted
  (localStorage). The pipeline pre-builds pairs with a minimum gap so answers are
  never coin-flips on data noise.

## Room 5 — THE MAP (GeoGuessr-ish) — `/map` ✦ Phase 2, built

- 5 rounds: "Pin it" — a fact describes a place/event; click the world map.
- Scored by great-circle distance: `100 · e^(−km/1500)` per round (100 at 0 km,
  ~51 at 1,000 km), same 0-100 scale as The Clock.
- The map is **offline**: Natural Earth land polygons from the `world-atlas`
  npm package rendered as SVG (equirectangular) — no tile servers, keeping the
  playable-from-clone rule. qtype `where` carries `lat`/`lng` truth coordinates;
  fuel comes from restcountries capitals (`geo_ingest.py`) and curated landmarks.

## Room 6 — THE DAILY — `/daily` ✦ Phase 2, built

- One round from each room — 2 multiple choice, a year guess, a higher/lower,
  a map pin — 100 pts each, 500 cap. Date-seeded: same gauntlet for everyone.
- One play per day (localStorage); result renders as a shareable emoji line
  (`🟩 ≥80 · 🟨 ≥40 · 🟥 <40`) copied to the clipboard — the Wordle loop.

## Room 7 — THE JUKEBOX (name-that-tune) — `/jukebox` ✦ Phase 3, built

- 5 rounds, 4 choices. Offline it plays **synthesized melodies** note-by-note
  through a Web Audio oscillator (`lib/sound.ts` `playMelody`) — zero audio files,
  so it works from a clone. Live, `music_ingest.py` attaches Deezer 30s `preview`
  URLs (qtype `audio_guess`) and it streams the clip instead. Animated equalizer.

## Room 8 — THE GALLERY (visual ID) — `/gallery` ✦ Phase 3, built

- 5 rounds. An image starts heavily blurred and **sharpens over ~6s**; the earlier
  you call it correctly, the more the round is worth (20–100). Offline fuel is
  country flags (flagcdn); live fuel adds TMDB posters and any captioned image
  (qtype `image_guess`, prompt varies by `answer_field`: flag / poster / title).

## Room 9 — THE BLITZ (speed round) — `/blitz` ✦ Phase 3, built

- 60-second multiple-choice sprint over the existing MC bank. Combo multiplier;
  every 5-in-a-row buys +3s, a miss costs 2s and breaks the combo with a screen
  shake. Keyboard-first (keys 1–4) and a deck + difficulty picker (`lib/decks.ts`).

## Room 10 — THE CONNECTIONS (grouping puzzle) — `/connections` ✦ Phase 3, built

- 16 tiles, four hidden groups of four, four mistakes allowed (NYT Connections).
  Date-seeded tile order for a shared daily puzzle; "one away" hint; the four
  groups colour-ramp yellow→purple by difficulty. Curated seed puzzles, plus a
  best-effort `forge_connections` recipe over answer-clusters (qtype `connections`).

## Meta — progression & the leaderboard ✦ Phase 3, built

- **THE BACK OFFICE** (`/profile`): localStorage-only XP/levels, per-category
  accuracy, a 12-week activity heatmap, personal bests, and unlockable achievement
  badges (`lib/profile.ts`). Every room records a result when a run ends.
- **Global leaderboard**: each scored room posts to the `submit-score` Supabase
  Edge Function (service-role write, so the anon client still never writes to the
  DB); with no backend it keeps a local per-device top-10. See `lib/leaderboard.ts`
  and `supabase/functions/submit-score/`.

## Room 11 — THE LOBBY (multiplayer buzzer) — `/lobby` ✦ Phase 4, built

- Host creates a room → 4-letter code. Others join by typing the code.
- Questions are streamed one at a time from the MC bank. Everyone sees the
  prompt; first to click **⚡ Buzz In!** gets the answer window.
- Correct answer = +1,000 pts. Miss = 0. Timer bar counts down (8s to buzz,
  10s to answer); host moves to the next question at their own pace.
- Live score sidebar updates after each reveal. Podium at the end.
- **Offline fallback**: degrades gracefully to a "requires backend" notice when
  `NEXT_PUBLIC_SUPABASE_URL` is absent — all other rooms stay playable.
- **Transport**: Supabase Realtime **Broadcast** (ephemeral, no DB rows written).
  Host drives the state machine; players mirror host broadcasts. Presence tracks
  connected player names for the lobby screen.

## Scoring & persistence philosophy

- v1: all progress in `localStorage` — frontend stays read-only against the DB
  (house convention: nothing in the frontend writes to Supabase).
- Leaderboards later via a tiny Supabase Edge Function (write path with rate
  limiting), keeping the anon-key read-only rule intact.

## Why this set works as a portfolio piece

Four rooms demonstrate four very different UIs (grid board, slider, quiz cards,
binary cards) over **one** data model — an architecture story you can tell in one
breath, with the dbt-built question bank underneath as the data-engineering story.
