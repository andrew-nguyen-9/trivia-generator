# HANDOFF → homepage session

Phases 2.11 (Mystery) and 2.12 (Gauntlet) deliberately **did not touch**
`app/page.tsx` / `components/Deck.tsx` / the `GAMES` array, to avoid colliding
with the concurrent homepage rework. These are the home-surface edits those
phases imply — apply them in the homepage branch:

## From 2.11 — The Mystery (crown jewel → dominant)

- Give **Mystery top billing**: first in the deck / the feature card, and scaled
  up relative to the other rooms. It is the site's dominant game.
- Mystery route is `/mystery`, emblem 𓂀, accent `history`. Its room label is
  `room 10 — sanctum mysterii`.

## From 2.12 — The Gauntlet (ex-Daily → slot 9)

- **Rename** the Daily card to **The Gauntlet**; route stays/links per 2.12 (see
  that phase's notes). Indiana-Jones treasure-run framing; emblem 𖣘.
- **Deck position = slot 9.**
- Remove/retire the **Blitz** card — Blitz is folded into the Gauntlet
  (`GAMES.md` Legacy folding). Its route/component retire when Gauntlet ships.

## Canon

`docs/v2/CANON.md` now defines the Secret Order roster + the one-reference rule.
If the home page names/depicts a member, use the Host (Board) per canon and keep
it to a single reference.
