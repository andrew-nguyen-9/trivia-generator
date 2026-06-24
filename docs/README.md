# PARLOR documentation

Start here. The v2 framework is canonical; v1 docs are archived for history.

## Canonical (v2)

| Doc | Read it for |
|---|---|
| [`v2/ROADMAP.md`](v2/ROADMAP.md) | The spine: every phase 2.1–2.19, goals, dependencies, requirement→phase traceability, the Secret Order canon, Claude Design integration |
| [`v2/DESIGN_SYSTEM.md`](v2/DESIGN_SYSTEM.md) | The logo-derived visual language, card-deck system, light/dark, reference-site learnings, Unsplash, Claude Design tooling |
| [`v2/GAMES.md`](v2/GAMES.md) | Per-game refurbishment specs (2.3–2.12), legacy folding, the cross-game character canon |
| [`v2/PLATFORM.md`](v2/PLATFORM.md) | Pipeline fix (2.1), SEO, accessibility, light/dark, performance, mobile, cross-browser, site pages |
| [`v2/PHASE_PROMPTS.md`](v2/PHASE_PROMPTS.md) | Copy-paste **initiation prompt** for each phase — open this to start a phase |
| [`FILE_INDEX.md`](FILE_INDEX.md) | Annotated map of every directory and file in the repo |

## History

| | |
|---|---|
| [`../CHANGELOG.md`](../CHANGELOG.md) | Version policy (1.0.0 frozen, 2.x.x per phase) + history |
| [`archive/`](archive/) | v1.0.0 documentation, superseded by `v2/` |

## How v2 ships

`main` → `v2` (integration) → `phase/2.N-<slug>` sub-branches → PR into `v2`. When
all phases land, one PR `v2 → main`, tag `v2.0.0`. Details in `v2/ROADMAP.md`.
