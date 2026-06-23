# PARLOR v2 — Phase Initiation Prompts

Copy-paste prompts to start each phase in a fresh session. Open this doc, grab the
preamble + the phase block, paste, go. Each phase has a branch, scope, **END STATE**,
and a hard **STOP** boundary so a session doesn't drift into the next phase.

## Shared preamble (prepend to every phase)

```
PARLOR (trivia-generator). Source of truth: docs/v2/ (ROADMAP, DESIGN_SYSTEM,
GAMES, PLATFORM) + this PHASE_PROMPTS.md. Read the relevant doc section first.
Git: branch this phase off the latest `v2` as phase/<id>-<slug>; PR into `v2`
only — never touch `main`. Keep caveman + ponytail on; use rtk for git/file ops;
lean on superpowers skills + the Claude Design → frontend-design →
chrome-devtools/playwright loop for visual work. Bump frontend/package.json to the
phase version on the PR. STOP at the boundary below — do not start the next phase.
```

---

## 2.0 — Docs Framework · `phase/2.0-docs-framework`
```
Execute Phase 2.0: the v2 documentation set + archive v1 docs. Write CHANGELOG.md,
docs/README.md, docs/FILE_INDEX.md, docs/v2/{ROADMAP,DESIGN_SYSTEM,GAMES,PLATFORM,
PHASE_PROMPTS}.md, docs/archive/README.md; git mv the v1 docs into docs/archive/;
fix the root README docs table + CLAUDE.md doc pointers; bump package.json to 2.0.0.
END STATE: docs build complete, requirement→phase traceability table in ROADMAP,
cross-links resolve, only doc/archive/version changes in `git status`, PR into v2.
STOP: documentation only. (This phase is complete on this branch.)
```

## 2.1 — Pipeline Resurrection · `phase/2.1-pipeline-resurrection`
```
Execute PLATFORM.md §2.1. Fix the push race (shared concurrency group across
etl_daily.yml + wiki_hard.yml AND git pull --rebase before push); assert
permissions: contents: write; add an if: failure() step that opens a GitHub issue;
replace blanket continue-on-error with a health gate that fails when forged
facts/questions fall below threshold; make export_seed.py refusals + dbt test
failures hard-fail; write the future-Claude runbook into PLATFORM.md §2.1.
END STATE: a workflow_dispatch run goes green and commits a fresh bank; a
deliberately-broken run opens an issue; data/raw mtimes are current.
STOP: pipeline reliability + runbook only. No UI, game, or branding work.
```

## 2.2 — Brand + Design System + Card-Deck Home · `phase/2.2-brand-design-home`
```
Execute DESIGN_SYSTEM.md + the branding cleanup. Remove every "after-dark" reference
in the live tree (README.md, frontend/app/page.tsx, GH repo description; leave
docs/archive/* as history) and reframe voice to mystery/intrigue. Codify the logo
tokens/motifs. Rebuild frontend/app/page.tsx as a DECK OF UNIQUE CARDS (one per
game) with card-trick motion (deal/flip/fan/shuffle) and reduced-motion fallbacks
stubbed. Use the Claude Design → frontend-design → chrome-devtools/playwright loop.
END STATE: home renders as the card deck; `grep -ri "after.dark"` over the live tree
(excluding docs/archive) is empty; tokens documented + in use; build passes.
STOP: home + brand + design-system foundation only. Do NOT redesign game rooms.
```

## 2.3 — The Board · `phase/2.3-board`
```
Execute GAMES.md §2.3: a daily THEME that reskins all five column headers + their
visual treatment; richer visuals; in-game UI settings (text size, hint toggle,
reduced-motion); fold in Gallery's blur-reveal as an optional clue style; add the
host character tie-in.
END STATE: a dated theme reskins all five columns; settings work; selftest + build
green. STOP: Board only.
```

## 2.4 — The Clock · `phase/2.4-clock`
```
Execute GAMES.md §2.4: grandfather-clock UI; a logic-puzzle layer that constrains
the date; rotating calendar systems (Gregorian/Mayan/etc.) as a daily twist; fold in
Jukebox "when was this released" audio rounds (lib/sound.ts); Clockkeeper tie-in.
END STATE: clock-face UI + daily calendar + logic layer playable; build green.
STOP: Clock only.
```

## 2.5 — The Wedges · `phase/2.5-wedges`
```
Execute GAMES.md §2.5: daily shattered-mirror UI; playful-ghost countdown joke on
miss/timeout; PER-CATEGORY LOCKOUT; SHARED DAILY QUESTION ORDER per category (extend
lib/rng.ts pickRotating, keyed by daySeed); optional BONUS ROUND for unseen
questions; resident-ghost tie-in.
END STATE: two players on the same date get identical per-category order; completed
categories stop serving; bonus round reachable; build green. STOP: Wedges only.
```

## 2.6 — The Streak · `phase/2.6-streak`
```
Execute GAMES.md §2.6: a witch's candle whose flame brightens per correct answer; a
timer that ACCELERATES as the streak grows; on timeout the page darkens to a
cursor-following glow + finish text + copy-paste results; more categories; Witch
tie-in. HARD CONSTRAINT: the flame/darkness must never reduce question/answer
legibility; reduced-motion freezes the flame.
END STATE: flame intensifies, timer accelerates, darkness-finish + shareable result
work, legibility verified; build green. STOP: Streak only.
```

## 2.7 — The Map · `phase/2.7-map`
```
Execute GAMES.md §2.7: FIX the stray lines in components/WorldMap.tsx; reframe as a
history game cycling a DAILY ANCIENT CIVILIZATION with tangential teaching questions
(incl. modern pop culture); fold in Gallery artifact reveals; Cartographer tie-in.
END STATE: map renders clean (no stray lines); civilization rotates daily; questions
tie to it; build green. STOP: Map only.
```

## 2.8 — The Thread · `phase/2.8-thread`
```
Execute GAMES.md §2.8: answers chain last-letter→first-letter under ONE recognizable
theme; per-answer link explanation on reveal; final question = "what is the thread?";
thread/thimble/sewing/weaving UI; fold in Connections grouping as a variant; add a
thread/qtype + forge recipe; Weaver tie-in.
END STATE: a daily themed chain plays end-to-end with per-link explanations + the
final thread question; sewing UI present; build green. STOP: Thread only.
```

## 2.9 — The Séance (REDO) · `phase/2.9-seance`
```
Execute GAMES.md §2.9. BRAINSTORM FIRST (superpowers:brainstorming) among the
directions in the doc; record the chosen design in GAMES.md §2.9; then build the new
game from scratch (deterministic daily, solvable, offline, shareable, a11y); Medium
tie-in. END STATE: chosen design recorded; new Séance playable; build + any new tests
green. STOP: Séance only.
```

## 2.10 — The Ladder (REDO) · `phase/2.10-ladder`
```
Execute GAMES.md §2.10. BRAINSTORM FIRST; record the chosen design; then build a
math/logic game with Dr-Strange/Loki trickster-illusion framing and Queens-style
constraint solving with twists; fold in Connections constraints; Trickster tie-in.
END STATE: chosen design recorded; new logic/math Ladder playable; build + tests
green. STOP: Ladder only.
```

## 2.11 — The Mystery (CROWN JEWEL) · `phase/2.11-mystery`
```
Execute GAMES.md §2.11. Reference (don't duplicate) docs/archive/superpowers/ specs.
Make Mystery the DOMINANT game (top home placement + scale). SIMPLER UX (collapse the
Alibi/Relationship/Map/Evidence/Timeline panel sprawl into one progressive flow);
HARDER LOGIC + WEAKER HINTS; one clear creative daily logic. Define the Secret Order
CANON roster + the "one reference per game" rule; start the tie-in checklist.
END STATE: simplified single-flow Mystery; daily case still solvable (vitest green);
home gives it top billing; canon documented. STOP: Mystery only.
```

## 2.12 — The Gauntlet · `phase/2.12-gauntlet`
```
Execute GAMES.md §2.12: rename The Daily to The Gauntlet; Indiana-Jones treasure run
across all games; SPEED-BASED scoring; HINTS COST TIME; fold in Blitz's sprint; move
it to deck slot 9; Adventurer tie-in.
END STATE: timed multi-game run with hint-time penalties + shareable result; deck
position = slot 9; build green. STOP: Gauntlet only.
```

## 2.13 — SEO · `phase/2.13-seo`
```
Execute PLATFORM.md §2.13: per-route Next metadata (mystery voice), app/sitemap.ts,
app/robots.ts, OG/Twitter cards from the seal, JSON-LD.
END STATE: sitemap + robots resolve; every route has unique metadata; OG previews
render. STOP: SEO only — no visual redesign.
```

## 2.14 — Accessibility · `phase/2.14-accessibility`
```
Execute PLATFORM.md §2.14: honor prefers-reduced-motion across card/flame/404 motion;
color-blind-safe category encoding (not color-only); readable type/contrast +
focus-visible; ARIA + full keyboard play for every room.
END STATE: reduced-motion kills non-essential animation; categories distinguishable
without color; rooms keyboard-playable; axe/Lighthouse a11y clean. STOP: a11y only.
```

## 2.15 — Light/Dark Mode · `phase/2.15-theme`
```
Execute PLATFORM.md §2.15 + DESIGN_SYSTEM light/dark: implement candlelit-dark +
daylit-light by remapping semantic tokens; system preference + persisted manual
toggle; SSR-safe (no flash; obey lib/rng.ts SSR rules).
END STATE: toggle persists; both themes coherent; no hydration flash. STOP: theming
only.
```

## 2.16 — Performance · `phase/2.16-performance`
```
Execute PLATFORM.md §2.16: cut cache/CPU/GPU/API; audit Framer Motion; lazy-load
heavy rooms; size images; trim client components; verify with chrome-devtools
lighthouse_audit + performance traces (record before/after).
END STATE: documented Lighthouse perf gains; no gameplay regressions. STOP: perf
only — no new features.
```

## 2.17 — Mobile · `phase/2.17-mobile`
```
Execute PLATFORM.md §2.17: touch targets, responsive room layouts, the deck reflowed
for small screens, gesture support; verify with playwright mobile emulation.
END STATE: every room usable + correct on a phone viewport. STOP: mobile only.
```

## 2.18 — Cross-Browser · `phase/2.18-cross-browser`
```
Execute PLATFORM.md §2.18: Chrome/Safari/Firefox parity via playwright multi-engine;
fix WebKit/Gecko gotchas (backdrop-filter, AudioContext unlock, background-clip:text,
SVG/topojson).
END STATE: playwright passes on all three engines; gotchas resolved. STOP:
cross-browser only.
```

## 2.19 — Site Pages · `phase/2.19-site-pages`
```
Execute PLATFORM.md §2.19: About page (Secret Order lore), a sitemap page, a 404 with
FLOATING CARDS that bounce off the frame + text and form magical shapes on actions
(reuse 2.2 card motion; reduced-motion fallback), and a site-wide footer with nav
back to an9.dev.
END STATE: /about, sitemap page, 404, and footer all live + linked. STOP: site pages
only. After this PR merges, v2 is feature-complete → open the single v2 → main PR and
tag v2.0.0.
```
