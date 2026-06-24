# PARLOR v2 — Platform

The pipeline fix (2.1) and the platform-hardening phases (2.13–2.19). Pairs with
`DESIGN_SYSTEM.md` for the visual ones.

---

## 2.1 — Pipeline Resurrection

The nightly Action (`.github/workflows/etl_daily.yml`) has failed silently for ~a
week. Make it reliable, observable, and self-documenting.

### Diagnosis

- **Primary cause — push race.** Both `etl_daily.yml` (daily) and `wiki_hard.yml`
  (every 6h) end by committing to `main` with **no `git pull --rebase` before
  `git push`**. When `wiki_hard` commits between the daily run's `checkout` and its
  `push`, the daily push is rejected (non-fast-forward) → the job fails and nothing
  is committed.
- **Compounded by zero observability.** No Slack/email/issue on failure; every
  ingest is `continue-on-error: true`, so total data decay looks like success.
- **Secondary candidate — permissions.** Repo "Workflow permissions" must be
  *Read and write* (README documents this); a reset would also break the push.

### Fix recipe

1. **Serialize + rebase.** Add a shared `concurrency` group across **both** workflows
   (e.g. `group: bank-writer`, `cancel-in-progress: false`) so they never push
   concurrently, **and** `git pull --rebase origin main` immediately before
   `git push` in both. (Belt and suspenders: the concurrency group prevents the
   race; the rebase recovers if anything still lands in between.)
2. **Assert permissions.** Add job-level `permissions: { contents: write }` to the
   publish job and the wiki_hard job; verify repo Settings → Actions → Read and
   write.
3. **Observability.** Add an `if: failure()` step that opens/updates a GitHub issue
   via `gh issue create` (label `pipeline-failure`), with the failing job + run URL.
   Optional Slack webhook behind a secret.
4. **Health gate, not silent decay.** After the forge, fail the run if total forged
   questions (or per-source fact counts) fall below a threshold — replace blanket
   `continue-on-error` tolerance with a real floor. Surface the dbt
   `mart_category_stats` health report as a check, not just a log line.
5. **Propagate real failures.** Make `export_seed.py`'s "refusing to export" and any
   dbt test failure exit non-zero with a clear message so the workflow goes red
   (today some failures are swallowed).

### Runbook (for future Claude)

**Symptoms**: seed bank stale; `data/raw/*.jsonl` mtimes old; no recent
`parlor-etl` commits; Actions tab shows red `etl_daily`.

**First checks** (read-only):
- Actions tab → latest `etl_daily` run → which job failed (extract / transform /
  publish).
- `git log -1 --format=%an data/raw/` — last author + date of a bank refresh.
- Compare `etl_daily` vs `wiki_hard` run times — overlap suggests the push race.
- Repo Settings → Actions → Workflow permissions = Read and write?

**Known causes → fix**:
- Push rejected (non-fast-forward) → the race; ensure concurrency group + rebase
  are in place (fix #1).
- `Permission denied`/`403` on push → permissions (fix #2).
- Publish skipped → dbt tests failed in transform (by design); read the test output;
  fix the data or the test.
- "refusing to export" → bank regressed in category spread; check ingests produced
  data (health gate, fix #4).

**Verify a fix**:
- `cd pipeline && python selftest.py` (offline) must pass.
- Re-run via `workflow_dispatch`; confirm a green run **and** a fresh commit to
  `data/raw` + `frontend/public/seed-questions.json`.
- Deliberately break a step on a scratch branch to confirm the failure issue opens.

### As built (2.1)

Concrete knobs the runbook above refers to:
- **Shared concurrency group** `bank-writer` (`cancel-in-progress: false`) on *both*
  `etl_daily.yml` and `wiki_hard.yml` — serializes every bank writer.
- **Rebase before push**: `git pull --rebase --autostash origin <branch>` precedes
  `git push` in both (no `|| true` — a failed rebase surfaces).
- **Permissions**: `contents: write` on the publish job (etl) and scrape-hard
  (wiki_hard); `issues: write` where the failure issue is opened.
- **Health floor**: `question_forge.py --min-questions 100` (baseline ≈335) exits
  non-zero on a starved forge; the transform job's category step fails below 3
  categories. `export_seed.py` already hard-exits ("refusing to export…").
- **Observability**: an `if: failure()` path (the `notify-failure` job in etl, an
  inline step in wiki_hard) opens — or comments on the existing — issue labelled
  `pipeline-failure`, so repeat failures don't spam.

#### Source health (per-source starvation, audited 2026-06-24)

While the pipeline was frozen, the publish/commit step never ran, so the
keyless ingests that *do* work (Deezer, Sleeper/ESPN) had **never committed any
bronze** — the live bank was music 5 / sports 0 / screen 2 out of 475. Each
ingest is `continue-on-error: true`, and the only floor is the forge's total
`--min-questions`, which history alone clears — so a single dead source decays
silently. Mitigations: back-seeded `data/raw/deezer.jsonl` (100) +
`data/raw/sports.jsonl` (50) so the next forge isn't starved; the nightly will
now accumulate both. **Still open: screen/TMDB** — `screen_ingest.py` is gated
on `secrets.TMDB_API_KEY`; with no key it never runs and `screen` stays at ~2
(Gallery room runs near-empty). Add the key, or treat screen as a soft category.
Future hardening: a per-category floor in the health gate, not just a total.

### Done-when

A `workflow_dispatch` run goes green and commits a fresh bank; a deliberately broken
run opens an issue; `data/raw` mtimes are current; runbook is in this doc.

---

## 2.13 — SEO

Per-route Next `metadata` (unique title/description in the mystery voice);
`app/sitemap.ts` + `app/robots.ts`; OG/Twitter cards using the seal; JSON-LD
structured data (WebSite, and per-game where it fits). **Done-when**: sitemap +
robots resolve, every route has unique metadata, OG previews render.

## 2.14 — Accessibility ✅ (core shipped)

> Shipped: `globals.css` reduced-motion now also caps `animation-iteration-count`
> (infinite decorations were looping at a 0.01ms duration) and kills every named
> perpetual animation; a global `:focus-visible` brass ring covers all interactive
> elements. `CATEGORY_GLYPH` in `lib/types.ts` is the single non-color category
> channel (suit glyph), wired through `RoomShell`. The Map gained an arrow-key
> reticle (`WorldMap.tsx`) so pin-drop is keyboard-playable; the Clock year
> selector is a native `<input type=range>`. New games (Séance/Ladder) ship ARIA
> grids + reduced-motion guards. Remaining: a live axe/Lighthouse audit pass
> (needs a running server) and the glyph channel on every last color-only swatch.

- Honor `prefers-reduced-motion` across **all** v2 motion — the card deck (2.2), the
  Streak flame + darkness (2.6), the 404 cards (2.19): static/eased fallbacks, no
  perpetual animation.
- **Color-blind-safe**: never encode category by color alone — pair with suit/glyph/
  label (constrains `CATEGORY_HEX` usage).
- Readable type scale + contrast (WCAG AA); focus-visible states.
- ARIA + full keyboard play for every room; the Map pin, the year slider, the
  card flips all keyboard-operable.
- **Done-when**: reduced-motion kills non-essential animation; categories
  distinguishable without color; rooms keyboard-playable; axe/Lighthouse a11y clean.

## 2.15 — Light/Dark Mode ✅

> Shipped. Semantic tokens (`bg/surface/line/ink/muted/brass/gold/…`) are now CSS
> RGB-channel vars in `globals.css` (`:root` dark, `[data-theme="light"]` daylit);
> `tailwind.config.ts` points the token colours at them as
> `rgb(var(--c-x) / <alpha-value>)` so opacity modifiers still work. A pre-paint
> inline script in `layout.tsx` resolves stored → system → dark onto
> `<html data-theme>` (no flash; `suppressHydrationWarning`). `ThemeToggle.tsx`
> (fixed bottom-right) persists the manual choice to `localStorage`. Category
> jewels stay static (single source). **Done-when**: ✅ toggle persists · both
> themes coherent · no hydration flash.

## 2.16 — Performance ◐ (code wins shipped; live audit pending)

> Shipped: the win-only canvas `Confetti` (127-line RAF component) is now
> `next/dynamic({ ssr:false })` across all 8 games, so it's an on-demand chunk
> instead of route weight (e.g. /clock 7.5→5.7 kB, /gallery & /jukebox 4.4→2.5 kB,
> /board 64.9→62.9 kB first-party). Reduced-motion already caps perpetual
> animations (2.14). `next.config` keeps remote-image patterns; route-level code
> splitting is automatic per room. **Remaining (needs a running deployment):** the
> `chrome-devtools lighthouse_audit` + `performance_*` before/after numbers, and
> converting dynamic-dimension content images to `next/image` (deferred — risky to
> do without visual verification).

> Shipped (2.22): the biggest single bundle win — `/board` was **291 KB First
> Load / 79 KB route JS**, a ~76 KB outlier over every other room. Cause:
> `BoardGame` (client) imported `buildBoardColumns` from `lib/queries`, which
> statically imports the 232 KB seed bank — so the whole offline bank shipped to
> every board visitor's browser for nothing (the board data is already fetched
> server-side). Extracted the pure arranger to seed-free `lib/board.ts`; `/board`
> is now **217 KB / 5.4 KB**, in line with the deck. Re-verified board play +
> practice mode in-browser. Audit also confirmed already-good hygiene: WorldMap's
> ~50-80 KB topojson is a lazy `import()`, Confetti is code-split, all daily rooms
> carry ISR `revalidate`, and no other client component leaks a data blob.

Reduce cache/CPU/GPU/API load; make it fast everywhere.

- Audit Framer Motion usage (no perpetual off-screen animation — a11y + perf win).
- Lazy-load heavy rooms/assets (the `WorldMap` topojson is already lazy; extend the
  pattern); size all images (`next/image`); minimize `"use client"` surface.
- Cache headers (`vercel.json` already sets immutable image caching) + sensible
  data caching.
- **Gate**: `chrome-devtools` `lighthouse_audit` + `performance_*` traces; record
  before/after.
- **Done-when**: documented Lighthouse perf gains, no gameplay regressions.

## 2.17 — Mobile ◐ (code shipped; playwright gate pending)

> Shipped: the new logic-grid rooms now meet the 44px touch-target floor on phones
> — Séance cells are `h-11 w-11` on mobile (shrinking to `sm:h-9` for mouse); the
> Ladder grid was already 44px. Both rooms use `flex-wrap` HUDs, single-column
> clue stacks on small screens, and `overflow-x-auto` matrices; the deck already
> reflows (clamp widths + responsive `deck-spread` grid + `touch-action: pan-y`).
> **Remaining (needs the harness):** the full `playwright` mobile-emulation sweep
> across every room.

Touch-first: adequate touch targets, responsive room layouts, the card deck reflowed
for small screens, gesture support (swipe/drag where natural). **Done-when**: every
room usable + correct on a phone viewport (playwright mobile emulation passes).

## 2.18 — Cross-Browser ◐ (gotchas resolved; playwright sweep pending)

> Audit outcome — most gotchas were already handled: Tailwind auto-prefixes
> `backdrop-blur` (`-webkit-backdrop-filter`); `lib/sound.ts` falls back to
> `webkitAudioContext` and calls `ctx.resume()` on every play (inside the click
> gesture, so Safari unlocks); `background-clip: text` carries `-webkit-` on every
> gilt rule. Fixed: the one raw-CSS `.deck-zoom-backdrop` now has
> `-webkit-backdrop-filter`. **Known remaining quirk:** `.gilt`/`.deck-pip` use
> `background-attachment: fixed` for the cursor-driven gold, which iOS Safari
> ignores — left as-is (restructuring risks regressions without visual checks).
> **Remaining (needs the harness):** the `playwright` Chrome/Safari/Firefox sweep.

Chrome / Safari / Firefox parity via `playwright` multi-engine runs. Watch the known
gotchas: `backdrop-filter`, `AudioContext` unlock (Safari), `background-clip: text`
(used in the hero), SVG/topojson rendering. **Done-when**: playwright passes on all
three engines; gotchas resolved.

## 2.19 — Site Pages

- **About** — the Secret Order lore + what PARLOR is (mystery/intrigue framing).
- **Sitemap page** — human-readable index of rooms + pages (complements 2.13's
  `sitemap.xml`).
- **404** — floating cards that **bounce off the frame edges and against any text**,
  and on specific actions arrange into **magical shapes** (reuse the 2.2 card-motion
  vocabulary; reduced-motion fallback per 2.14).
- **Footer** — present site-wide; navigation **back to the an9.dev site**.
- **Done-when**: `/about`, sitemap page, 404, and footer all live + linked. After
  this PR merges, v2 is feature-complete → open the single `v2 → main` PR, tag
  `v2.0.0`.

---

## Branding cleanup (req #13, executed in 2.2, tracked here)

Remove "after-dark" everywhere and reframe to mystery/intrigue. Known references at
v1 (re-grep before editing, line numbers drift):

- `README.md` — title "an after-dark house of trivia games"
- `docs/archive/GAME_MODES.md`, `docs/archive/UI_SPEC.md` — archived; leave as v1
  history (do not rewrite archived docs).
- `frontend/app/page.tsx` — "members' entrance · after dark" microlabel
- GitHub repo **description** — update to the mystery framing.

Verify with `grep -ri "after.dark"` over the live tree (excluding `docs/archive/`)
returning empty.
