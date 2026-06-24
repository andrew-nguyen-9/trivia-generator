# PARLOR v2 — Game Refurbishments

Per-game specs for phases 2.3–2.12, plus the legacy-folding map and the cross-game
character canon. Each section: **current → v2 target → mechanics → UI/motion →
character tie-in → data/forge impact → done-when.** Data/forge changes touch
recipes in `pipeline/question_forge.py`, the `qtype` enum in `db/schema.sql`, and
`frontend/lib/types.ts` (keep them in sync — see CLAUDE.md "Add a new question
type").

---

## 2.3 — The Board

- **Current**: Jeopardy 5×5, daily double, easy (MC) / hard (free-text). Static
  category headers.
- **v2 target**: a **daily theme** that reskins the whole board — the five column
  categories *and* their visual treatment shift with the theme (e.g. "Egypt",
  "Noir", "The Voyage"). More visuals; in-game UI settings.
- **Mechanics**: theme chosen deterministically by date (`lib/rng.ts daySeed`);
  columns drawn to fit the theme where data allows, falling back to standard
  categories. Daily double preserved.
- **UI/motion**: themed column headers (art + color), card-flip reveal, an in-game
  **settings panel** (text size, hint on/off, reduced-motion respect).
- **Character tie-in**: the board is "hosted" by one Secret Order character
  (portrait + nameplate on the board frame).
- **Data/forge**: add theme tagging to questions (theme keyword in `meta`); forge
  groups by theme. No new qtype.
- **Done-when**: a dated theme reskins all five columns + visuals; settings work;
  `selftest.py` + `frontend` build green.

## 2.4 — The Clock

- **Current**: drag a year slider; distance-scored; optional decade hint.
- **v2 target**: a **grandfather-clock** interface, a **logic-puzzle** layer, and
  **rotating calendar systems** (Gregorian / Mayan / French Republican / etc.) as a
  daily twist that reframes how you read/answer the date.
- **Mechanics**: keep year-distance scoring; add a deduction layer (clues constrain
  the possible date range — narrow it, don't just guess). Calendar of the day
  changes the display + an occasional conversion puzzle.
- **UI/motion**: ornate clock face, pendulum, moving hands as the year selector;
  calendar styled to the day's system.
- **Character tie-in**: the Clockkeeper (a Secret Order horologist).
- **Data/forge**: reuse `year_guess` facts; add optional clue fields for the logic
  layer. Folds in **Jukebox** "when was this released" audio rounds (audio via
  `lib/sound.ts`, no asset files).
- **Done-when**: clock-face UI + daily calendar + logic layer playable; build green.

## 2.5 — The Wedges

- **Current**: six wedges, 20 quickfire questions across categories.
- **v2 target**: a **daily-different shattered circular mirror** UI; a **playful
  ghost** that cracks a joke on a miss/timeout via a countdown; **per-category
  lockout**; a **shared daily question list per category in a fixed indexed order**
  (so shared results are comparable); an optional **bonus round**.
- **Mechanics**:
  - **Lockout**: once a category's wedge is complete, no more of its questions
    appear.
  - **Shared order**: all players on a given date get the *same questions per
    category in the same index order* — extend `lib/rng.ts pickRotating` to a
    deterministic per-category ordered list keyed by `daySeed`.
  - **Ghost countdown**: each question has a timer; on miss/timeout the ghost delivers
    a themed quip.
  - **Bonus round**: after the six wedges, optionally face the questions you never
    saw.
- **UI/motion**: a circular mirror that shatters along different fault lines each day
  (date-seeded); shards = wedges; the ghost is a drifting candle-lit wisp.
- **Character tie-in**: the resident ghost (a Secret Order character who "didn't
  leave").
- **Data/forge**: no new qtype; needs enough per-category volume for ordered,
  non-repeating daily lists — health-gated by 2.1.
- **Done-when**: two players on the same date get identical per-category order;
  completed categories stop serving; bonus round reachable; build green.

## 2.6 — The Streak

- **Current**: higher/lower comparison chain; one miss ends the run.
- **v2 target**: a **witch enchanting a spell** — a candle whose **flame grows
  brighter** with each correct answer, a **countdown that accelerates** as the
  streak grows, and on timeout the **page darkens to a cursor-following glow** with
  finish text + copy-paste results. More categories.
- **Mechanics**: timer per answer shrinks as the streak climbs; flame brightness =
  fn(streak). Run ends on wrong answer *or* timeout. Cycle through more categories
  than v1.
- **UI/motion**: candle + flame bloom that intensifies (the seal's flame, alive);
  accelerating ring timer; on end, viewport fades to near-black with a radial glow
  tracking the cursor (cue from andreigorskikh.digital). **Hard constraint
  (a11y, 2.14): the flame/darkness must never reduce question/answer legibility** —
  text stays at full contrast; effects sit behind a readable layer; reduced-motion
  freezes the flame at steady brightness.
- **Character tie-in**: the Witch of the Order.
- **Data/forge**: reuse `higher_lower`; widen category coverage.
- **Done-when**: flame intensifies, timer accelerates, darkness-finish + shareable
  result work, legibility verified; build green.

## 2.7 — The Map

- **Current**: pin on the SVG world map, km-scored. **Bug: stray lines render on the
  map** (`components/WorldMap.tsx`).
- **v2 target**: **fix the stray lines**, then reframe as a **history game cycling a
  daily ancient civilization** (Egyptian, Roman, Maya, Mesopotamian, …) with
  questions tangential to it — including modern pop-culture (Egypt day → even "Walk
  Like an Egyptian"). Teach geography by placing history on the map.
- **Mechanics**: civilization chosen by date; the day's questions tie to its region
  and culture (near and far). Keep pin-drop km scoring; add "place this civilization
  / site" rounds.
- **UI/motion**: the seal's glyph ring frames the map; the day's civilization styles
  the border/markers; antique-map treatment (Unsplash texture, 2.2).
- **Character tie-in**: the Cartographer / well-travelled explorer of the Order.
- **Data/forge**: reuse `where` facts (lat/lng); tag facts by civilization/era; new
  tangential questions can be `multiple_choice` themed to the day. Folds in
  **Gallery** artifact-image reveals (image of an artifact → place/identify it).
- **Done-when**: map renders clean (no stray lines), civilization rotates daily,
  questions tie to it; build green.

## 2.8 — The Thread

- **Current**: chain of clues, each answer feeding the next.
- **v2 target**: answers chain by **last letter → first letter**; all questions tie
  (even tangentially) to **one recognizable theme** (a year / country / genre /
  person / war / book / movie / TV show); after each reveal, an **explanation of the
  link**; the final question asks **"what is the thread that ties them all
  together?"** A **thread / thimble / sewing / weaving** UI.
- **Mechanics**: build a daily chain where answer[n] ends with the letter answer[n+1]
  begins with, every item connected to a hidden master theme; the theme is
  recognizable but individual questions can be far-removed. Final guess = the theme.
- **UI/motion**: a needle pulling thread between answers; stitches forming; the
  finished thread "weaves" into the theme reveal.
- **Character tie-in**: the Weaver / Seamstress of the Order.
- **Data/forge**: needs a chain-builder (graph over facts by answer spelling + a
  shared `meta` theme tag); likely a **new forge recipe + qtype** (`thread`). Folds
  in **Connections** grouping logic as a variant (group-by-theme).
- **Done-when**: a daily themed chain plays end-to-end with per-link explanations +
  the final thread question; sewing UI present; build green.

## 2.9 — The Séance (FULL REDO) — ✅ CHOSEN DESIGN

> Built. The brainstorm picked the **daily constraint-logic puzzle** direction (a
> "Scrying Matrix" zebra/logic-grid) over the spirit-board / mediumship sketches.

- **Why redo**: v1 "who/what am I with costly clues" is thin and overlaps the
  Mystery/Ladder.
- **Concept**: the medium stabilises a corrupted spirit message by resolving a
  uniquely-solvable logic grid. N "seats" at the table × K occult attribute
  categories (relic / sin / fate / …), each a bijection; clues (identity,
  exclusion, ordering, neighbour, seat-pin) narrow to one configuration. **Pure
  logic, not trivia** — no fact-provenance trail needed.
- **Engine** (`frontend/lib/seance.ts`, pure + tested): builds the truth matrix
  from the day seed, enumerates all true clues, then the **Subtraction Method**
  (prune a clue → re-solve → keep only if still unique) yields a minimal,
  uniquely-solvable set. Propagation + backtracking solver caps the solution
  count at 2 for the uniqueness gate. Weekly **Spirit packs**
  (`seanceFlavor.ts`) supply the cast; weekday sets grid size (Mon N=4 intro →
  Sun N=7 "Exorcism").
- **Determinism & archive**: generation is **not** client-side or offline.
  `scripts/generate-seance.ts` (run in `etl_daily.yml`, write role) pre-computes
  today + 14 days into the Neon **`seance_puzzles`** archive (date-keyed). The
  frontend only **reads** (`getSeancePuzzle`, read-only role); no row / no DB →
  dark state, **no seed fallback**. The table is the archive → debugging +
  `/seance?date=YYYY-MM-DD` archive-play of any past night.
- **UX**: tap-once = snuffed candle ✕ (exclusion), tap-twice = glowing rune ◯
  (confirm) with auto row/column propagation; count-up "Ectoplasmic Decay"
  timer; invalid submission → **Poltergeist Strike** (screen-shake + **+60s**);
  **Whisper-mode** scratchpad layer (Fri–Sun); atmospheric vignette deepens with
  time; win → emoji share + **Grimoire** (`lib/grimoire.ts`, localStorage
  meta-progression of banished spirits).
- **a11y**: ARIA grid + per-cell labels, native-button keyboard play,
  `prefers-reduced-motion` freezes shake/vignette (deepened further in 2.14).
- **Character tie-in**: the Medium of the Order (séance host).
- **Done-when**: ✅ design recorded · new Séance playable · `seance.test.ts`
  (uniqueness / determinism / minimality / weekday scaling) + build green.

## 2.10 — The Ladder (FULL REDO)

> **Brainstorm first.** Record the chosen design here before building.

- **Why redo**: v1 "closest-match by magnitude/region" overlaps Streak/Connections.
- **v2 direction**: **math + logic** puzzles with **Dr-Strange / Loki / trickster,
  illusion** framing and **Queens-style** (LinkedIn) constraint solving — twists and
  misdirection you must reason through.
- **Brainstorm directions**:
  - *Constraint grid* (Queens-like): place items on a grid under rules derived from
    trivia facts (one per row/region/era), deduced not guessed.
  - *Illusion sequences*: a number/logic sequence where the "obvious" next step is a
    trap; the trickster hides the real rule.
  - *Paradox doors*: pick the door whose statement is logically consistent given
    trivia-sourced premises.
- **Constraints**: deterministic daily; uniquely solvable by logic; offline;
  shareable; a11y.
- **Character tie-in**: the Trickster / Illusionist of the Order.
- **Data/forge**: likely numeric/relational facts as puzzle premises; possibly a new
  `qtype`. Folds in **Connections** constraint logic.
- **Done-when**: chosen design recorded; new logic/math Ladder playable; build +
  tests green.

## 2.11 — The Mystery (CROWN JEWEL)

> Reference, **do not duplicate**, the existing specs:
> `docs/archive/superpowers/specs/2026-06-16-mystery-rework-design.md`,
> `…/2026-06-17-mystery-investigation-redesign.md`, and the matching plans. This
> section reconciles them with the v2 **simplify** mandate.

- **Current**: a rich daily WHO/WHERE/WHEN case, but **too busy** — Alibi,
  Relationship, Map, Evidence, Timeline panels + accusation form; hints give away
  too much.
- **v2 target**: the **dominant** game on the site (top home placement + scale).
  **Simpler UX/UI** (collapse the panel sprawl into one clear investigation flow);
  **harder logic** with **weaker hints**; **one clear, definitive, creative daily
  logic**. The **canon hub**: defines the cast every other game references.
- **Mechanics**: keep deterministic daily generation + solvability guarantee
  (`lib/mystery.ts` `generateCase`/`verifySolvable`; tests in `mystery.test.ts`).
  Reduce hint strength so deduction is required; one elegant logical path per day.
- **UI/motion**: single investigation surface (progressive disclosure instead of
  many simultaneous panels); the all-seeing eye as the motif.
- **Character canon**: this game's roster *is* the Secret Order cast. Publish the
  roster + the "one reference per game" rule (see ROADMAP cross-cutting); wire the
  tie-ins listed in each game spec.
- **Data/forge**: pure-function generator (no API); reconcile with archived specs.
- **Done-when**: simplified single-flow Mystery; daily case still solvable (vitest
  green); home gives it top billing; canon documented + tie-in checklist started.

## 2.12 — The Gauntlet (ex-Daily, moved to slot 9)

- **Current**: "The Daily" — one round from every room, shareable emoji line.
- **v2 target**: rename/reframe as **The Gauntlet** — an **Indiana-Jones treasure
  run**: traverse obstacles by answering rounds drawn from every game; **speed-based**
  scoring; **hints cost time** (using a hint adds to your total). Sits at **game-slot
  9** in the deck.
- **Mechanics**: a sequence of trials (one per game type); timer runs continuously;
  optional hints add a time penalty; final time = score; same gauntlet for everyone
  per day. Shareable result line preserved.
- **UI/motion**: temple/expedition framing — obstacles, traps, a treasure at the end;
  the run reads as a journey, not a quiz list.
- **Character tie-in**: the Adventurer / relic-hunter of the Order.
- **Data/forge**: reuses every room's questions; folds in **Blitz**'s speed-sprint
  mechanic.
- **Done-when**: timed multi-game run with hint-time penalties + shareable result;
  deck position = slot 9; build green.

---

## Legacy folding

The five non-keeper rooms are absorbed, not maintained. Retire their routes +
components once the host game ships the folded mechanic.

| Legacy room | Folds into | As |
|---|---|---|
| Jukebox (audio ID) | Clock (2.4), Thread (2.8) | "when/what is this" audio rounds via `lib/sound.ts` |
| Gallery (image reveal) | Board (2.3), Map (2.7) | blur/artifact-reveal clue style |
| Blitz (speed sprint) | Gauntlet (2.12) | the timed-trial core |
| Connections (grouping) | Thread (2.8), Ladder (2.10) | group-by-theme / constraint variant |
| Lobby (multiplayer) | — | **deferred**: parked as a v2.x stretch; not folded now |

Routes/components to retire when folded: `app/{jukebox,gallery,blitz,connections}/`,
their `*Game.tsx`, and (deferred) `app/lobby/` + `lib/lobby.ts`.

## Character canon (owned by 2.11)

Single source of the Secret Order cast; each game carries exactly one reference.
Working tie-in slots (finalized in 2.11):

Board → Host · Clock → Clockkeeper · Wedges → resident Ghost · Streak → Witch ·
Map → Cartographer · Thread → Weaver · Séance → Medium · Ladder → Trickster ·
Gauntlet → Adventurer · Mystery → the full roster + the rule.
