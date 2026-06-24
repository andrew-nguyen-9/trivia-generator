# THE MYSTERY rework — design spec

Date: 2026-06-16
Status: approved, pending implementation plan

## Why

THE MYSTERY (`/mystery`, Room 10) is currently a daily social-deduction case
generated deterministically from the date (`frontend/lib/mystery.ts`), played
through `frontend/components/MysteryGame.tsx`. Today:

- Deduction is shallow: `deduceCulprits()` just checks whether a suspect has a
  relationship edge to the victim/ringleader — flavor text, not a puzzle a
  player can actually solve by cross-referencing clues.
- Only 4 clues, revealed one at a time via a button.
- Dossiers are one-at-a-time accordions; there's no way to see all suspects
  side by side, and no way to take notes.
- The accusation is "pick up to 3 suspects" — no room or hour involved.
- No scoring beyond a correct/incorrect boolean.

This rework: makes the deduction a real, mechanically-verifiable logic puzzle
(WHO + WHERE + WHEN, with a room×hour elimination matrix); expands the clue
set; adds a table view and a book view for seeing/tracking all suspects at
once, including player-settable status tags that double as the "build your
own table" ask; and adds a scoring system (clue-reveal count, elapsed time,
tracking-table accuracy) with a shareable result string.

Five mockups (React/Tailwind exports, visual reference only — not shipped
code) informed the layout: an intro card, a 3-column investigate screen, a
verdict screen, a table-view tracking grid, and a book-view two-page spread
with a room×hour deduction matrix. They're saved under
`/Users/andrewnguyen/Documents/Inspiration/Screen {2,3,4,5,6}.zip` (outside
the repo).

## 1. Puzzle generation & solver rewrite (`frontend/lib/mystery.ts`)

Stays deterministic (`mulberry32(seedFromDate(date))`), zero LLM/API, same
cast/roster/relationship machinery. Changes:

### Clue set: 4 → 7 clues, each tagged with what it eliminates

```ts
export interface Clue {
  stage: number;
  kind: string;
  title: string;
  text: string;
  eliminates?: { rooms?: string[]; hours?: number[] }; // indices into ROOMS/HOURS
}
```

Clue plan (stages 1–7, revealed in order):

1. **Witness Statement (WHEN, narrows hours)** — "no one was in any room
   between 6 and 7" style text; sets `eliminates.hours` to 2 of the 4
   non-murder hour indices.
2. **Witness Statement (WHERE, narrows rooms)** — similar, for 2 of the 5
   non-scene rooms.
3. **Witness Statement (WHEN, narrows hours further)** — eliminates 1 more
   non-murder hour, leaving exactly the murder hour un-eliminated.
4. **Physical Evidence** — the ringleader's quirk, as today (narrows WHO).
5. **Witness Statement (WHERE, narrows rooms further)** — eliminates enough
   remaining non-scene rooms that exactly the murder scene survives.
6. **Timeline Discovery / broken alibi** — as today (confirms WHO).
7. **Secret Relationship / motive** — as today (corroborates WHO).

Generation must guarantee the elimination clues actually narrow to exactly
one surviving room and one surviving hour — generate candidate
eliminate-sets, reject/retry (deterministically, still seeded by `rnd`) if a
combination would eliminate the true scene/hour or leave more than one
survivor after all clues are accounted for.

### Room×hour elimination matrix (derived, not stored)

```ts
export type Mark = "confirmed" | "ruled-out" | "unknown";
export function deductionMatrix(c: MysteryCase, cluesRevealed: number): Mark[][] // [room][hour]
```

- Start every cell `"unknown"`.
- For each revealed clue (up to `cluesRevealed`), mark its `eliminates.rooms`
  × all hours and `eliminates.hours` × all rooms as `"ruled-out"`.
- The true `(scene, hourIndex)` cell becomes `"confirmed"` once all other
  cells in its row AND column are `"ruled-out"` (i.e., it's the last man
  standing — never hardcoded, always derived, so the UI and the solver agree).

### Solver (`verifySolvable`, extended)

Three independent checks, all must pass for a case to be considered valid
(generation retries with a new internal counter if not — still pure
function of `date`, just rejection-sampled):

1. **WHO**: same as today — the lied-about-the-hour set must equal
   `c.culprits` exactly (already implemented via alibi construction).
2. **WHERE**: `deductionMatrix(c, 7)` must have exactly one `"confirmed"`
   room-cell-column (i.e., exactly one room has all-but-one... — concretely:
   exactly one room is not fully `"ruled-out"` across all hours).
3. **WHEN**: symmetric check for hours.

`generateCase` calls `verifySolvable`-equivalent checks internally and
perturbs the elimination-clue selection (reseeding a local counter, not the
public date-seed) until all three pass. This keeps `generateCase(date)` pure
and deterministic per date — same date always yields the same final case —
while guaranteeing solvability.

### Removed: the old relationship-web `deduceCulprits` heuristic

Replaced by the alibi-lying check (already partially implemented, just
cleaned up to not depend on relationship edges at all — relationships become
flavor/dossier content only, not a deduction mechanism).

## 2. Scoring (`frontend/lib/mysteryScore.ts`, new file)

```ts
export interface MysteryAttempt {
  whoGuess: string[];
  whereGuess: string | null;
  whenGuess: number | null;
  cluesRevealed: number; // 1..7
  elapsedSeconds: number;
  tableTags: Record<string, "potential" | "prime" | "cleared" | undefined>;
}

export function score(c: MysteryCase, a: MysteryAttempt): {
  total: number;
  won: boolean; // who+where+when all correct
  breakdown: { base: number; cluePenalty: number; timePenalty: number; tableBonus: number };
}
```

- `base = 1000`
- `cluePenalty = 80 * max(0, cluesRevealed - 1)` (first clue free)
- `timePenalty = floor(elapsedSeconds / 5)`, capped so `base - cluePenalty -
  timePenalty >= 0` before the table bonus is added
- `tableBonus = 40 * (suspects correctly tagged "prime" if culprit, "cleared"
  if innocent, at the moment of accusation)`
- `won = whoGuess set equals c.culprits AND whereGuess === c.scene AND
  whenGuess === c.hourIndex`

### Share string

```ts
export function shareText(c: MysteryCase, a: MysteryAttempt, result: ReturnType<typeof score>): string
```

Format:
```
🕵️ PARLOR — CASE #898 — CASE CLOSED 🔓
Score: 740 · Clues: 3/7 · Time: 4:12
🟩🟩🟨⬜⬜⬜⬜
```
Square mapping per clue index: 🟩 = never revealed, 🟨 = revealed and was one
of the load-bearing elimination/evidence clues for the final correct
answer, ⬜ = revealed but not load-bearing. Cold-case (incorrect) results
swap the header line to `🕵️ PARLOR — CASE #898 — COLD CASE ❄️` and keep the
same score/clue/time line and squares below it. Copies to clipboard via
`navigator.clipboard.writeText`.

### Wiring into profile/XP

Add `"mystery"` to `ROOMS` in `frontend/lib/profile.ts`, call
`applyResult({ room: "mystery", score: result.total, correct: result.won ?
1 : 0, total: 1 })` when an attempt is recorded — same pattern every other
room follows.

## 3. Investigate UI (`frontend/components/MysteryGame.tsx` → split)

New file structure:
- `MysteryIntro.tsx` — redesigned per Screen 2 (WHO/WHERE/WHEN "???" teaser
  cards, suspect avatar strip, countdown to midnight). Starts the stopwatch
  on "begin investigation".
- `MysteryInvestigate.tsx` — the core rework, desktop 3-column / mobile
  tabbed (see below).
- `MysteryVerdict.tsx` — redesigned per Screen 4 (verdict, score, motive/
  scene/hour grid, "SHARE RESULT" button). No archive/stats buttons (those
  already exist on `/profile`, out of scope).
- `MysteryGame.tsx` becomes a thin stage-router between the three, replacing
  its current inline-everything implementation.

### Desktop layout (≥ some breakpoint, e.g. `lg:`)

3 columns, matching Screen 3:
- **Left — Suspects**: card list, each with avatar/name/role/quirk-chip and
  a clickable **status pill** cycling blank → POTENTIAL → PRIME → CLEARED →
  blank. PRIME suspects populate the WHO accusation field automatically
  (selecting/deselecting PRIME tags *is* building the WHO guess — no separate
  multi-select needed). No cap on how many suspects can be tagged PRIME; the
  WHO guess is simply "every suspect currently tagged PRIME", and `won` is
  decided by exact set equality against `c.culprits` (1–3 suspects).
- **Middle — Evidence Log + Submit Accusation**: all revealed clues listed
  (still revealed progressively via a "reveal next clue" button below the
  list — clue pacing stays staged per your answer); WHO (derived from PRIME
  tags, read-only display) / WHERE / WHEN dropdowns; submit button.
- **Right — Timeline + Dossier**: per-hour known-events list (only hours
  covered by a revealed clue show text, others show "???"); relationship
  feed (flat list, not per-suspect accordions).

### Table / Book toggle

A toggle control switches the **left+right** content (suspects/dossier
data) between:

- **Table view** (default, Screen 5): one row per suspect — avatar/name,
  role, motive ("???" until clue 6/7 revealed), claimed scene+hour at the
  murder hour, relationship tag, and the status pill (same one from the
  3-column layout — shared state, not duplicated). Footer row: cleared
  count, clues-found count, confidence % (tagged-suspects ÷ total).
- **Book view** (Screen 6): two-page spread with ← page / page → controls.
  Left page: suspect cards grid (denser, same data as table rows). Right
  page: clue list + the room×hour elimination matrix rendered from
  `deductionMatrix()` (✓ confirmed / ✗ ruled-out / ? unknown).

Both views and the 3-column layout all read/write the same React state
(revealed clue count, status tags, accusation fields) — switching views
never loses progress.

### Mobile (below the desktop breakpoint)

Tabbed layout: "Suspects" / "Evidence" / "Timeline" as swipeable/tappable
tabs instead of 3 columns. Table/Book toggle still available within the
"Suspects" tab. Accusation form lives at the bottom of "Evidence".

## 4. Persistence

Extend the existing `localStorage` shape (`parlor:mystery:{date}`) to store
the full `MysteryAttempt` plus the computed score, not just `{guess,
correct, at}` — needed so reopening a completed case can re-render the
verdict screen with score/share-string intact.

## 5. Testing

Add `vitest` to `frontend/` (new dev dependency + `vitest.config.ts` +
`package.json` script `"test"`). New test file
`frontend/lib/mystery.test.ts`:

- For a large range of seed dates (e.g. 200+ consecutive days), assert
  `generateCase(date)` produces a case where the WHO/WHERE/WHEN solver
  checks all pass (no case ships unsolvable).
- Snapshot/assert determinism: `generateCase(date)` called twice yields
  identical output.
- Unit tests for `deductionMatrix()` (correct ✓/✗/? for known fixtures) and
  `score()` (penalty/bonus arithmetic for known fixtures).

## Out of scope (explicitly deferred)

- Case archive / browsing past cases.
- Changes to `/profile` stats display beyond the new `"mystery"` room
  entry already supported by existing code.
- Any backend/DB involvement — stays 100% client-side, deterministic,
  zero tokens, per house rules in `CLAUDE.md`.
