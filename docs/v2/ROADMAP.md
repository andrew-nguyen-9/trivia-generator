# PARLOR v2 — Roadmap

The spine of v2. Every phase, its goal, dependencies, and where it lives. Companion
docs hold the detail: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md),
[`GAMES.md`](GAMES.md), [`PLATFORM.md`](PLATFORM.md). To **start** a phase, open
[`PHASE_PROMPTS.md`](PHASE_PROMPTS.md).

## Why v2

PARLOR shipped as v1.0.0 — ten games over a nightly-forged question bank. Three
things forced a new era:

1. **The nightly pipeline has been failing silently for ~a week.** Bronze files are
   stale; only manual `wiki_hard` runs still commit. The app's freshness promise is
   broken and nobody is told. (Fixed in **2.1**.)
2. **The UI reads vibe-coded** despite a genuinely strong brand. The `.logo/`
   "Secret Order" seal — an engraved gold spade, an all-seeing eye, a candle flame,
   a question-mark tail, a ring of occult glyphs on deep oxblood — is a complete
   design language the execution hasn't earned yet. (Codified in **2.2**, applied
   everywhere after.)
3. **The "after-dark" framing reads adult in the wrong way.** v2 is about mystery
   and intrigue, not nightlife. (Removed in **2.2**.)

## Decisions (locked)

- **Name stays "PARLOR."** Drop all "after-dark" copy. **"The Secret Order"** is the
  in-world lore framing — the society, the mansion, the cast that ties the games
  together.
- **Fold** the five legacy rooms (Jukebox, Gallery, Blitz, Connections, multiplayer
  Lobby) into the ten keepers rather than maintain or delete them. (Mapping in
  `GAMES.md`.)
- **Sequence:** fix the pipeline → establish brand + design system + home → refurbish
  games → harden the platform.

## Version policy

v1.0.0 is the frozen baseline. v2 is `2.x.x`, **one minor per phase**. Work lands on
the `v2` integration branch via `phase/2.N-<slug>` sub-branches (PR into `v2`). When
all phases land, `v2 → main`, tag **`v2.0.0`**. See `../CHANGELOG.md`.

```
main ── v2 ──┬── phase/2.0-docs-framework   (this)
             ├── phase/2.1-pipeline-resurrection
             ├── phase/2.2-brand-design-home
             └── … phase/2.19-site-pages
```

## Phase tree

| Phase | Name | Goal | Detail |
|---|---|---|---|
| **2.0** | Docs Framework | This documentation set + archive v1 | — |
| **2.1** | Pipeline Resurrection | Reliable, observable, self-documenting nightly Action | PLATFORM §2.1 |
| **2.2** | Brand + Design System + Card-Deck Home | Drop after-dark; codify the logo; home as a deck of unique cards with card-trick motion | DESIGN_SYSTEM |
| **2.3** | The Board | Daily theme reskins all columns; richer visuals + UI settings | GAMES §2.3 |
| **2.4** | The Clock | Grandfather-clock UI; logic-puzzle layer; rotating calendars (Mayan etc.) | GAMES §2.4 |
| **2.5** | The Wedges | Shattered-mirror UI; ghost countdown; per-category lockout; shared daily order; bonus round | GAMES §2.5 |
| **2.6** | The Streak | Witch's candle that brightens; accelerating timer; darkness finish; more categories | GAMES §2.6 |
| **2.7** | The Map | Fix stray lines; rotating ancient civilization + tangential history | GAMES §2.7 |
| **2.8** | The Thread | Last-letter chains under one recognizable theme; link reveals; sewing UI | GAMES §2.8 |
| **2.9** | The Séance | **Full redo** (brainstorm + build) | GAMES §2.9 |
| **2.10** | The Ladder | **Full redo** — math/logic, trickster framing, Queens-style twists | GAMES §2.10 |
| **2.11** | The Mystery | Crown jewel: simpler UX, harder logic, weaker hints; the canon hub | GAMES §2.11 |
| **2.12** | The Gauntlet | Indiana-Jones speed run across all games; hints cost time; slot 9 | GAMES §2.12 |
| **2.13** | SEO | Metadata, sitemap, robots, OG, structured data | PLATFORM §2.13 |
| **2.14** | Accessibility | Reduced motion, color-blind-safe, readable type, ARIA, keyboard | PLATFORM §2.14 |
| **2.15** | Light/Dark Mode | Daylit-mansion light theme + candlelit dark; system + toggle | PLATFORM §2.15 |
| **2.16** | Performance | Cut cache/CPU/GPU/API; Lighthouse-gated | PLATFORM §2.16 |
| **2.17** | Mobile | Touch-first layouts for every room | PLATFORM §2.17 |
| **2.18** | Cross-Browser | Chrome/Safari/Firefox parity | PLATFORM §2.18 |
| **2.19** | Site Pages | About, sitemap page, magical-card 404, footer → an9.dev | PLATFORM §2.19 |

## Dependencies

- **2.1 first** — unblocks fresh data; independent of everything visual.
- **2.2 before any game** — games inherit the design system once, not twice.
- **2.3–2.12** — each game is independent; order is suggested, not strict (Mystery
  2.11 should precede final canon wiring in other games).
- **2.13–2.18** — ride alongside or after the games; 2.14 (a11y) and 2.15 (theme)
  constrain all visual work, so their *rules* are honored from 2.2 onward even
  though the dedicated phases formalize them.
- **2.19 last** — reuses the 2.2 card-motion vocabulary.

## Cross-cutting: the Secret Order canon

A named cast of mansion characters lives in **The Mystery (2.11)**. Every other game
carries **exactly one** character reference — a card face, a ghost's voice, a host,
a portrait — tying back to that cast. The Mystery owns the canon; each game spec in
`GAMES.md` names its tie-in. Tracking checklist:

- [ ] 2.3 Board · [ ] 2.4 Clock · [ ] 2.5 Wedges · [ ] 2.6 Streak · [ ] 2.7 Map ·
  [ ] 2.8 Thread · [ ] 2.9 Séance · [ ] 2.10 Ladder · [ ] 2.12 Gauntlet
- [ ] 2.11 Mystery defines the roster + the rule

## Claude Design integration

v2 visual work runs a consistent tooling loop (detailed in DESIGN_SYSTEM §"Claude
Design tooling"):

1. **Draft** — Claude Design (`import-claude-design-from-url`) / Figma
   (`figma-generate-design`) to draft card faces and room layouts from the seal +
   reference sites.
2. **Build** — the `frontend-design` / `ce-frontend-design` skills.
3. **Verify** — `chrome-devtools` (`lighthouse_audit`, `performance_*`) and
   `playwright` for visual, perf, a11y, and cross-browser QA.

## Requirement → phase traceability

Every original request maps to a phase. Nothing dropped.

| # | Request | Phase(s) |
|---|---|---|
| 1 | Documentation for all files | **2.0** (`FILE_INDEX.md`) |
| 2 | Version 1.0.0 current, 2.x.x future | **2.0** (`CHANGELOG.md`, this policy) |
| 3a | Fix the failing Git Action (+ prevention, alerting, runbook) | **2.1** |
| 3b | Card-deck magician homepage, unique cards, card tricks | **2.2** |
| 3c-i | Board: daily theme reskinning columns + visuals/settings | **2.3** |
| 3c-ii | Clock: grandfather clock, logic puzzles, calendars | **2.4** |
| 3c-iii | Wedges: shattered mirror, ghost countdown, lockout, shared order, bonus | **2.5** |
| 3c-iv | Streak: brightening candle, accelerating timer, darkness finish | **2.6** |
| 3c-v | Map: fix lines, ancient civilizations, tangential history | **2.7** |
| 3c-vii | Thread: letter chains, themes, link reveals, sewing UI | **2.8** |
| 3c-viii | Séance: full redo | **2.9** |
| 3c-ix | Ladder: full redo, math/logic/trickster | **2.10** |
| 3c-x | Mystery: crown jewel, simpler, harder, canon hub | **2.11** |
| 3c-vi | Daily → Gauntlet: Indiana Jones, speed, hint penalties, slot 9 | **2.12** |
| 4 | SEO optimizer | **2.13** |
| 5 | Security/accessibility (reduced motion, color blindness) | **2.14** |
| 6 | Browser optimization (cache/CPU/GPU/API, fast) | **2.16** |
| 7 | Mobile friendly | **2.17** |
| 8 | Chrome/Safari/Firefox | **2.18** |
| 9 | Use the real logo, base UI on it | **2.2** (DESIGN_SYSTEM) |
| 10 | Study the 7 reference sites | **2.2** (DESIGN_SYSTEM) |
| 11 | Use Unsplash images | **2.2** (DESIGN_SYSTEM) |
| 12 | Dark + light mode | **2.15** |
| 13 | Remove "after-dark" branding everywhere | **2.2** |
| 14 | About page, sitemap, magical-card 404, footer → an9.dev | **2.19** |
