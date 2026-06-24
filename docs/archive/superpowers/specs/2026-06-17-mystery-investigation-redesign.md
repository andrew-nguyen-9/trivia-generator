# Mystery Investigation Redesign — Design Spec

**Date:** 2026-06-17  
**Status:** Approved  
**Builds on:** `2026-06-16-mystery-rework-design.md`

---

## Goal

Replace the current `table / book` toggle in `MysteryInvestigate` with a three-tab full-width investigation panel (Alibi Tracker, Map View, Relationship Map), integrate a Supabase dataset of 16,436 rows that enriches alibi/witness/evidence text, add character tooltips, fix dropdown capitalization, and replace the hardcoded verdict message with procedurally generated prose.

---

## Architecture

### Tab Navigation

`MysteryInvestigate` gets a full-width tab bar replacing the current `viewMode` toggle:

```
[ ⬡ RELATIONSHIP MAP ]  [ ⊞ ALIBI TRACKER ]  [ ≡ MAP VIEW ]
```

Each tab renders full-width below the header. The right-hand evidence log + accusation form stay as a sidebar on `lg:` and above; on mobile they become a fourth tab (`evidence`).

### New / Modified Files

| File | Change |
|---|---|
| `frontend/lib/mysterySupabase.ts` | new — lazy Supabase client using existing `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `frontend/lib/mysteryEnrich.ts` | new — `enrichCase(c, rng)` → `MysteryContext` |
| `frontend/lib/mysteryTypes.ts` | new — shared types: `MysteryContext`, `AlibiEntry`, `WitnessEntry`, etc. |
| `frontend/components/MysteryAlibiTracker.tsx` | replaces `MysteryDossierTable` |
| `frontend/components/MysteryMapView.tsx` | new — mansion map with timeline |
| `frontend/components/MysteryRelationshipMap.tsx` | new — radial web |
| `frontend/components/MysteryCharacterTooltip.tsx` | new — shared hover tooltip |
| `frontend/components/MysteryDossierTable.tsx` | deleted |
| `frontend/components/MysteryDossierBook.tsx` | deleted |
| `frontend/components/MysteryInvestigate.tsx` | modified — three-tab nav, passes `MysteryContext` |
| `frontend/components/MysteryAccusationForm.tsx` | modified — capitalize room/hour labels |
| `frontend/components/MysteryVerdict.tsx` | modified — procedural message |
| `frontend/public/mansion-map.jpg` | new — mansion illustration (from user-provided image) |

---

## Section 1 — Supabase Data Layer

### Environment

Uses the existing Parlor env vars (no new vars needed):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### `frontend/lib/mysterySupabase.ts`

Lazy singleton `createClient` from `@supabase/supabase-js`. Returns `null` if env vars are unset (offline/seed-bank mode). All query functions return empty arrays on failure rather than throwing.

### `frontend/lib/mysteryTypes.ts`

```ts
export interface AlibiEntry {
  alibiId: string;
  characterScope: "generic" | "specific";
  characterId: string;
  roomId: string;
  hour: string;
  alibi: string;
}

export interface WitnessEntry {
  statementId: string;
  characterId: string;
  statementType: "true" | "false";
  statement: string;
  aboutCharacter: string;
  hour: string;
}

export interface EvidenceEntry {
  evidenceId: string;
  characterId: string;
  evidence: string;
  locationFound: string;
  forensicNote: string;
}

export interface SignatureClue {
  clueId: string;
  characterId: string;
  clue: string;
  roomFound: string;
  misleading: boolean;
}

export interface RedHerring {
  redHerringId: string;
  characterId: string;
  redHerring: string;
  apparentImplication: string;
  trueExplanation: string;
}

/** Per-character enrichment pulled from Supabase. */
export interface CharacterContext {
  alibis: AlibiEntry[];       // all hours for this character
  witnesses: WitnessEntry[];  // statements about others
  evidence: EvidenceEntry[];  // physical evidence for this character
  clues: SignatureClue[];     // signature clues (2–3 used per case)
  redHerrings: RedHerring[];  // red herrings seeded into clue text
}

/** Full enrichment for a generated case. */
export interface MysteryContext {
  byCharacter: Record<string, CharacterContext>;
  loaded: boolean; // false = Supabase unavailable, use fallback "???" text
}
```

### `frontend/lib/mysteryEnrich.ts`

`enrichCase(c: MysteryCase, rng: () => number): Promise<MysteryContext>`

1. Fetches rows for all 7–8 cast characters in parallel (7 suspects + victim) via `select ... in (id1, id2, ...)`.
2. Uses `rng` to pick specific rows per character (e.g. which 2 signature clues to surface, which red herring to inject). This keeps the enrichment deterministic for a given date.
3. Returns `MysteryContext`. On Supabase unavailability → returns `{ byCharacter: {}, loaded: false }`.

Tables queried: `mystery_alibis`, `mystery_witness_statements`, `mystery_character_evidence`, `mystery_signature_clues`, `mystery_red_herrings`.

*(Tables `mystery_character_secrets`, `mystery_character_motives`, `mystery_killer_motives`, `mystery_conspiracies`, `mystery_room_methods` reserved for Phase 3 — richer clue prose generator. Not queried in this spec.)*

---

## Section 2 — Alibi Tracker

**File:** `frontend/components/MysteryAlibiTracker.tsx`

Full-width `<table>` matching Screen 8 mockup.

### Columns
`Suspect | 6 PM | 7 PM | 8 PM | 9 PM | 10 PM | Verdict`

### Each Hour Cell
Two stacked pills:
1. **Location pill** (italic) — from `dossier.claimed[hourIndex]`, always available
2. **Alibi pill** — from `MysteryContext.byCharacter[id].alibis` matching `(room_id, hour)`. Falls back to `"???"` if not loaded.

**Dot color** (8px circle left of each pill):
- Gold (`#C9A24A`) — alibi has a corroborating witness (`WitnessEntry.statement_type === "true"` matching this hour)
- Red (`#8b1a1a`) — no witness found for this cell
- Green (`#2a6e3a`) — cross-confirmed: another suspect's statement places this character here

The **murder-hour column header** gets an ember-tinted underline once that hour has been deduced from clues (i.e., `deductionMatrix` has no surviving hours other than this one).

### Auto-Mark Toggle
A `⚡ Auto-mark` pill toggle above the table header. When enabled:
- Iterates suspects
- At the murder hour: if the alibi has a red dot (no witness) → set verdict tag to `"potential"`
- If all hours have gold/green dots → set verdict tag to `"cleared"`
- **Score penalty**: −150 pts added to `MysteryAttempt` (new field `autoMarkUsed: boolean`)

### Footer
`CLEARED: N · POTENTIAL: N · PRIME: N · UNVERIFIED ALIBIS: N`

Unverified = cells with red dots across all hours.

### Props
```ts
{
  mystery: MysteryCase;
  context: MysteryContext;
  cluesRevealed: number;
  tags: Record<string, SuspectTag>;
  onCycleTag: (id: string) => void;
  onAutoMark: () => void;
  autoMarkUsed: boolean;
}
```

---

## Section 3 — Map View

**File:** `frontend/components/MysteryMapView.tsx`

### Background
`<img src="/mansion-map.jpg" />` fills the container. The user saves the mansion illustration to `frontend/public/mansion-map.jpg`.

### Room Bounding Boxes (relative %, locked to the image)

| Room | x% | y% | w% | h% |
|---|---|---|---|---|
| Observatory | 26% | 2% | 48% | 42% |
| Smoking Lounge | 0% | 22% | 27% | 30% |
| Conservatory | 73% | 22% | 27% | 30% |
| Grand Ballroom | 26% | 42% | 48% | 22% |
| Velvet Library | 0% | 52% | 27% | 30% |
| Wine Cellar | 73% | 52% | 27% | 30% |

*(These percentages match the actual room positions in the mansion image and should be tuned during implementation.)*

### Door Topology

```ts
export const DOORS: [string, string][] = [
  ["observatory",     "grand-ballroom"],
  ["smoking-lounge",  "grand-ballroom"],
  ["conservatory",    "grand-ballroom"],
  ["velvet-library",  "grand-ballroom"],
  ["wine-cellar",     "grand-ballroom"],
  ["conservatory",    "wine-cellar"],   // side passage
];
```

Movement between non-Ballroom rooms routes through the Ballroom (shortest valid path).

### Character Placement

Given N characters in a room, compute polygon positions centered on the room's center:

```ts
function polygonPositions(n: number, cx: number, cy: number, r: number): [number, number][] {
  if (n === 1) return [[cx, cy]];
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}
```

Radius `r` scales with room size. No two characters share a slot — if a room has more characters than polygon slots, fallback to a tighter radius.

### Timeline Scrubber

A horizontal scrubber at the bottom of the map. 5 discrete snaps (6 PM → 10 PM). Labels show the hour. Dragging it updates `selectedHour` state. Character emojis animate to their `dossier.claimed[selectedHour]` room using `motion.div` + `layoutId` from Framer Motion. Animation follows the valid door path (characters pass through Ballroom as an intermediate waypoint).

### Tooltip
On hover over any character emoji: `MysteryCharacterTooltip` appears above showing name, title, trait, quirk, and relationship-to-victim.

### Post-verdict
After submit, culprits at `mystery.hourIndex` get a pulsing red glow ring.

---

## Section 4 — Relationship Map

**File:** `frontend/components/MysteryRelationshipMap.tsx`

### Layout
Pure SVG + CSS absolute. The victim emoji sits in a gold-bordered circle at center. The 7 suspects are evenly spaced clockwise on a single circumference ring (radius ~220px at standard desktop width, responsive via `viewBox`).

### Spokes (victim → suspect)
One SVG `<line>` per suspect. Color by relationship kind:
- `rival` / `secret-keeper` → red `rgba(110,31,43,0.5)`
- `business partner` / `debtor` → gold `rgba(201,162,74,0.5)`
- `old flame` → teal `rgba(42,95,90,0.5)`

SVG filter glow (`feGaussianBlur` + `feMerge`) applied on hover/focus.

### Between-suspect lines
Drawn from `dossier.relationships` edges at 15% opacity by default, colored by same scheme.

### Interaction
- **Hover**: highlights all lines for that suspect, dims others, shows `MysteryCharacterTooltip`.
- **Click (first)**: selects the character, highlights their connections.
- **Click (second character while one selected)**: "compare mode" — shows only the shared edge + a label pill between them. Click elsewhere to deselect.

### Props
```ts
{
  mystery: MysteryCase;
  context: MysteryContext;
}
```

---

## Section 5 — Character Tooltip

**File:** `frontend/components/MysteryCharacterTooltip.tsx`

Reusable. Triggered by wrapping any element in `<TooltipWrapper character={c} mystery={mystery} context={context}>`.

Shows:
- Emoji (large) + full name + title
- Trait (italic, one line)
- Quirk (signature item)
- Relationship to victim (if this character has a relationship edge to the victim in `dossier.relationships`, show the kind; otherwise "Unknown connection")

Positioned above the anchor, constrained to viewport with `useRef` + boundary check. Framer Motion `AnimatePresence` fade.

---

## Section 6 — Quick Fixes

### Dropdown Capitalization (`MysteryAccusationForm.tsx`)

Room names: `"the Velvet Library"` → display as `"The Velvet Library"` (title-case the leading "the"). Hours: already correct.

```ts
function displayRoom(r: string) {
  return r.replace(/^the /, "The ");
}
```

### Verdict Message (`MysteryVerdict.tsx`)

Replace the three hardcoded strings with a `verdictSummary(mystery, attempt, result): string` function:

| Condition | Message |
|---|---|
| `won` | "Flawless. You named every culprit, the exact room, and the precise hour. The Order is satisfied." |
| `whoCorrect && whereCorrect && !whenCorrect` | `"You knew who and where — but the hour eluded you. The crime happened at ${trueHour}, not ${guessedHour}."` |
| `whoCorrect && !whereCorrect && whenCorrect` | `"You had the right suspects and the right hour, but the wrong room. It happened in ${trueScene}."` |
| `whoCorrect && !whereCorrect && !whenCorrect` | `"You named the right culprit, but the room and hour were both wrong."` |
| `gotRingleader && !allCulpritsCovered` | `"You found the ringleader (${ring}), but ${missed.join(", ")} walked free."` |
| `!gotRingleader && gotAccomplice` | `"You caught an accomplice but the ringleader (${ring}) slipped away."` |
| no correct who | `"${trueRing} was the ringleader. They were in ${trueScene} at ${trueHour}."` |

---

## Section 7 — Scoring Update

Add `autoMarkUsed: boolean` to `MysteryAttempt`. In `mysteryScore.ts`:

```ts
const autoMarkPenalty = a.autoMarkUsed ? 150 : 0;
const afterPenalties = Math.max(0, base - cluePenalty - timePenalty - autoMarkPenalty);
```

---

## Supabase Schema

See SQL block at end of this document — run in the Supabase SQL Editor before importing CSVs.

### Import Order

1. Run the SQL (creates all 10 `mystery_*` tables + indexes + RLS).
2. For each table, go to **Table Editor → [table name] → Insert → Import data from CSV**.
3. Upload the matching CSV file. Column headers will auto-map.
4. Note: `misleading` and `victim_specific` columns import as text `"true"/"false"` — the schema uses `text` for these to avoid CSV boolean parsing issues; `mysteryEnrich.ts` casts to boolean in TS.

### SQL

```sql
-- ─────────────────────────────────────────────
-- mystery_alibis  (3,000 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_alibis (
  alibi_id        text primary key,
  character_scope text not null,  -- 'generic' | 'specific'
  character_id    text not null,  -- character slug or '—' for generic rows
  room_id         text not null,
  hour            text not null,
  alibi           text not null
);
create index if not exists mystery_alibis_char_room_hour
  on mystery_alibis (character_id, room_id, hour);

-- ─────────────────────────────────────────────
-- mystery_witness_statements  (6,000 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_witness_statements (
  statement_id    text primary key,
  character_id    text not null,
  statement_type  text not null,  -- 'true' | 'false'
  statement       text not null,
  about_character text not null,
  hour            text not null
);
create index if not exists mystery_ws_char
  on mystery_witness_statements (character_id);
create index if not exists mystery_ws_about
  on mystery_witness_statements (about_character);

-- ─────────────────────────────────────────────
-- mystery_character_evidence  (1,000 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_character_evidence (
  evidence_id    text primary key,
  character_id   text not null,
  evidence       text not null,
  location_found text not null,
  forensic_note  text not null
);
create index if not exists mystery_ce_char
  on mystery_character_evidence (character_id);

-- ─────────────────────────────────────────────
-- mystery_signature_clues  (1,000 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_signature_clues (
  clue_id      text primary key,
  character_id text not null,
  clue         text not null,
  room_found   text not null,
  misleading   text not null  -- 'true' | 'false' (cast to boolean in TS)
);
create index if not exists mystery_sc_char
  on mystery_signature_clues (character_id);

-- ─────────────────────────────────────────────
-- mystery_red_herrings  (2,000 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_red_herrings (
  red_herring_id       text primary key,
  character_id         text not null,
  red_herring          text not null,
  apparent_implication text not null,
  true_explanation     text not null
);
create index if not exists mystery_rh_char
  on mystery_red_herrings (character_id);

-- ─────────────────────────────────────────────
-- mystery_character_secrets  (1,000 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_character_secrets (
  secret_id    text primary key,
  character_id text not null,
  secret       text not null,
  category     text not null
);
create index if not exists mystery_cs_char
  on mystery_character_secrets (character_id);

-- ─────────────────────────────────────────────
-- mystery_character_motives  (1,000 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_character_motives (
  motive_id    text primary key,
  character_id text not null,
  motive       text not null,
  trigger      text not null
);
create index if not exists mystery_cm_char
  on mystery_character_motives (character_id);

-- ─────────────────────────────────────────────
-- mystery_killer_motives  (800 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_killer_motives (
  motive_id            text primary key,
  killer_count         integer not null,
  ringleader_relation  text not null,
  accomplice_relation  text,           -- null / '—' for single killers
  victim_relation      text not null,
  motive               text not null
);
create index if not exists mystery_km_count
  on mystery_killer_motives (killer_count);

-- ─────────────────────────────────────────────
-- mystery_conspiracies  (36 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_conspiracies (
  conspiracy_id    text primary key,
  killer_count     integer not null,
  name             text not null,
  description      text not null,
  shared_weakness  text not null
);
create index if not exists mystery_con_count
  on mystery_conspiracies (killer_count);

-- ─────────────────────────────────────────────
-- mystery_room_methods  (600 rows)
-- ─────────────────────────────────────────────
create table if not exists mystery_room_methods (
  method_id      text primary key,
  room_id        text not null,
  method_name    text not null,
  category       text not null,   -- 'generic' | 'room-specific' | 'victim-specific'
  victim_specific text not null,  -- 'true' | 'false'
  description    text not null
);
create index if not exists mystery_rm_room
  on mystery_room_methods (room_id);

-- ─────────────────────────────────────────────
-- RLS: all mystery tables are public-read
-- ─────────────────────────────────────────────
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'mystery_alibis',
    'mystery_witness_statements',
    'mystery_character_evidence',
    'mystery_signature_clues',
    'mystery_red_herrings',
    'mystery_character_secrets',
    'mystery_character_motives',
    'mystery_killer_motives',
    'mystery_conspiracies',
    'mystery_room_methods'
  ] loop
    execute format('alter table %I enable row level security', tbl);
    execute format(
      'create policy "public_read_%s" on %I for select using (true)',
      tbl, tbl
    );
  end loop;
end $$;
```

---

## Done Criteria

- All three tabs render in `MysteryInvestigate` and are selectable.
- Alibi Tracker shows all 5 hours × 7 suspects; alibi text loads from Supabase (falls back to `"???"` offline).
- Map View shows the mansion image background with SVG emoji overlays; timeline scrubber animates positions between hours.
- Relationship Map shows victim at center, 7 suspects radially; hover/click interactions work.
- Character tooltip appears on hover in all three views.
- Auto-mark sets verdict pills and applies −150 penalty.
- Dropdown rooms/hours display with proper capitalization.
- Verdict message is procedurally generated based on actual guess accuracy.
- `npm test` passes, `npx tsc --noEmit` passes.
