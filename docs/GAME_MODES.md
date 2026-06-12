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

## Phase 2 rooms (designed, not yet built)

| Room | Mechanic | Unblocked by |
|---|---|---|
| THE MAP (GeoGuessr-ish) | click a world map for "where did this happen", scored by km distance | a map widget (MapLibre + free OSM tiles) + Wikipedia coords already in `facts.meta` |
| THE JUKEBOX | name-that-tune from Deezer 30s previews | audio player UI; data already flows |
| THE DAILY | one cross-room gauntlet/day, shareable emoji results | seeded daily set already in schema (`daily_sets`) |
| THE LOBBY (multiplayer) | live buzzer rooms | Supabase Realtime channels |

## Scoring & persistence philosophy

- v1: all progress in `localStorage` — frontend stays read-only against the DB
  (house convention: nothing in the frontend writes to Supabase).
- Leaderboards later via a tiny Supabase Edge Function (write path with rate
  limiting), keeping the anon-key read-only rule intact.

## Why this set works as a portfolio piece

Four rooms demonstrate four very different UIs (grid board, slider, quiz cards,
binary cards) over **one** data model — an architecture story you can tell in one
breath, with the dbt-built question bank underneath as the data-engineering story.
