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

- The Daily is reframed as **The Gauntlet**. Point its deck card at **`/gauntlet`**
  (the old `/daily` now 307-redirects there, so nothing breaks in the meantime).
- **Deck position = slot 9.** Indiana-Jones treasure-run framing; timed, hints
  cost time. Emblem **𖣘**, accent `wildcard`.
- **Retire the Blitz card** — Blitz's sprint is folded into the Gauntlet
  (continuous clock). Its route/component (`app/blitz`, `BlitzGame.tsx`) can be
  deleted once the card is gone — left intact for now so the live deck link
  doesn't 404.

## Canon

`docs/v2/CANON.md` defines the Secret Order roster + the one-reference-per-game
rule. If the home page names/depicts a member, use the Host (Board) per canon
and keep it to a single reference.
