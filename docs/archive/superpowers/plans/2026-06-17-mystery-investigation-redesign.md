# Mystery Investigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the table/book toggle in MysteryInvestigate with three full-width tabs (Alibi Tracker, Map View, Relationship Map), wire in a Supabase enrichment layer for alibi/witness text, add character tooltips, fix dropdown capitalization, and replace the hardcoded verdict message with procedurally generated prose.

**Architecture:** A new Supabase data layer (`mysteryTypes.ts` → `mysterySupabase.ts` → `mysteryEnrich.ts`) fetches enrichment rows on mount and provides a `MysteryContext` object to all investigation components. `MysteryInvestigate` becomes a three-tab shell that renders `MysteryAlibiTracker`, `MysteryMapView`, and `MysteryRelationshipMap`; all three receive `MysteryContext` and use a shared `MysteryCharacterTooltip`. The old `MysteryDossierTable` and `MysteryDossierBook` are deleted once the new tab components are in place.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, `@supabase/supabase-js` (already installed at `^2.49.4`), Vitest for lib unit tests.

---

## File Map

| Status | Path | Responsibility |
|---|---|---|
| Create | `frontend/lib/mysteryTypes.ts` | Shared enrichment types: `MysteryContext`, `AlibiEntry`, `WitnessEntry`, etc. |
| Modify | `frontend/lib/mysteryScore.ts` | Add `autoMarkUsed: boolean` to `MysteryAttempt`, apply −150 penalty |
| Create | `frontend/lib/mysterySupabase.ts` | Lazy Supabase singleton, null-safe |
| Create | `frontend/lib/mysteryEnrich.ts` | `enrichCase(c, rng): Promise<MysteryContext>` |
| Create | `frontend/components/MysteryCharacterTooltip.tsx` | Shared `<TooltipWrapper>` hover tooltip |
| Create | `frontend/components/MysteryAlibiTracker.tsx` | Full-width Suspect × Hours table with auto-mark |
| Create | `frontend/components/MysteryMapView.tsx` | Mansion map background + SVG emoji overlay + timeline scrubber |
| Create | `frontend/components/MysteryRelationshipMap.tsx` | Radial SVG web with hover/click interactions |
| Modify | `frontend/components/MysteryInvestigate.tsx` | Three-tab nav; loads `MysteryContext`; wires `autoMarkUsed` |
| Modify | `frontend/components/MysteryAccusationForm.tsx` | Capitalize room labels |
| Modify | `frontend/components/MysteryVerdict.tsx` | Procedural verdict message |
| Delete | `frontend/components/MysteryDossierTable.tsx` | Replaced by MysteryAlibiTracker |
| Delete | `frontend/components/MysteryDossierBook.tsx` | Replaced by three-tab view |
| Create | `frontend/.env.local` | Forward `NEXT_PUBLIC_SUPABASE_*` to Next.js dev server |

---

## Task 1: Create `frontend/.env.local` with Supabase env vars

The Supabase keys are in the root `.env` but Next.js only picks up `.env.local` inside `frontend/`. This task creates that file so the dev server and builds can read the keys.

**Files:**
- Create: `frontend/.env.local`

- [ ] **Step 1: Create the file**

Write `frontend/.env.local` with this exact content:

```
NEXT_PUBLIC_SUPABASE_URL=https://lgxuudiogkrrdoemrsoc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_b8gqPm3rc3RH1Xbgjf-N-w_q1zVQgfL
```

- [ ] **Step 2: Verify the file is gitignored**

Run:
```bash
cat frontend/.gitignore | grep env
```
Expected output should include `.env*.local`. If it doesn't, check `frontend/.gitignore` and confirm `.env.local` is excluded before committing.

- [ ] **Step 3: Commit**

```bash
git add frontend/.env.local
git commit -m "chore: add frontend/.env.local for Supabase NEXT_PUBLIC_ vars"
```

---

## Task 2: Create `frontend/lib/mysteryTypes.ts`

Pure type definitions. No logic, no imports from other mystery files. Referenced by all subsequent tasks.

**Files:**
- Create: `frontend/lib/mysteryTypes.ts`

- [ ] **Step 1: Write the file**

```typescript
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

export interface CharacterContext {
  alibis: AlibiEntry[];
  witnesses: WitnessEntry[];
  evidence: EvidenceEntry[];
  clues: SignatureClue[];
  redHerrings: RedHerring[];
}

export interface MysteryContext {
  byCharacter: Record<string, CharacterContext>;
  loaded: boolean;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/mysteryTypes.ts
git commit -m "feat: add MysteryContext and enrichment type definitions"
```

---

## Task 3: Update `frontend/lib/mysteryScore.ts` — add `autoMarkUsed`

Add `autoMarkUsed: boolean` to `MysteryAttempt` and apply the −150 penalty in `score()`.

**Files:**
- Modify: `frontend/lib/mysteryScore.ts`

Current `MysteryAttempt` (lines 5–12):
```typescript
export interface MysteryAttempt {
  whoGuess: string[];
  whereGuess: string | null;
  whenGuess: number | null;
  cluesRevealed: number;
  elapsedSeconds: number;
  tableTags: Record<string, SuspectTag>;
}
```

Current `score()` penalty calculation (line 46):
```typescript
const afterPenalties = Math.max(0, base - cluePenalty - timePenalty);
```

- [ ] **Step 1: Add `autoMarkUsed` to the interface**

Replace the `MysteryAttempt` interface:
```typescript
export interface MysteryAttempt {
  whoGuess: string[];
  whereGuess: string | null;
  whenGuess: number | null;
  cluesRevealed: number;
  elapsedSeconds: number;
  tableTags: Record<string, SuspectTag>;
  autoMarkUsed: boolean;
}
```

- [ ] **Step 2: Apply the −150 penalty in `score()`**

Replace the single line:
```typescript
const afterPenalties = Math.max(0, base - cluePenalty - timePenalty);
```
With:
```typescript
const autoMarkPenalty = a.autoMarkUsed ? 150 : 0;
const afterPenalties = Math.max(0, base - cluePenalty - timePenalty - autoMarkPenalty);
```

- [ ] **Step 3: Update existing tests so they compile**

Open `frontend/lib/mysteryScore.test.ts`. Every `MysteryAttempt` literal needs `autoMarkUsed: false` added. Find every object that has `tableTags:` and append `autoMarkUsed: false` to it.

For example, replace every occurrence of a test attempt like:
```typescript
{
  whoGuess: [...],
  whereGuess: ...,
  whenGuess: ...,
  cluesRevealed: ...,
  elapsedSeconds: ...,
  tableTags: {},
}
```
With:
```typescript
{
  whoGuess: [...],
  whereGuess: ...,
  whenGuess: ...,
  cluesRevealed: ...,
  elapsedSeconds: ...,
  tableTags: {},
  autoMarkUsed: false,
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test 2>&1 | tail -20
```
Expected: all tests pass (14 total: 8 mystery + 6 mysteryScore).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/mysteryScore.ts frontend/lib/mysteryScore.test.ts
git commit -m "feat: add autoMarkUsed field and -150 penalty to mystery scoring"
```

---

## Task 4: Create `frontend/lib/mysterySupabase.ts` — lazy Supabase singleton

Lazy client that returns `null` when env vars are absent (offline/seed-bank mode). All downstream code handles `null` gracefully.

**Files:**
- Create: `frontend/lib/mysterySupabase.ts`

- [ ] **Step 1: Write the file**

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/mysterySupabase.ts
git commit -m "feat: add lazy Supabase singleton for mystery enrichment"
```

---

## Task 5: Create `frontend/lib/mysteryEnrich.ts` — case enrichment

Fetches enrichment rows from Supabase for all cast characters in parallel, uses `rng` for deterministic row selection, falls back to `{ byCharacter: {}, loaded: false }` on any failure.

**Files:**
- Create: `frontend/lib/mysteryEnrich.ts`

- [ ] **Step 1: Write the file**

```typescript
import type { MysteryCase } from "./mystery";
import type {
  MysteryContext,
  CharacterContext,
  AlibiEntry,
  WitnessEntry,
  EvidenceEntry,
  SignatureClue,
  RedHerring,
} from "./mysteryTypes";
import { getSupabaseClient } from "./mysterySupabase";

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  if (arr.length <= n) return arr;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

export async function enrichCase(
  c: MysteryCase,
  rng: () => number
): Promise<MysteryContext> {
  const sb = getSupabaseClient();
  if (!sb) return { byCharacter: {}, loaded: false };

  const characterIds = [c.victim.id, ...c.suspects.map((s) => s.id)];

  try {
    const [alibisRes, witnessRes, evidenceRes, cluesRes, herringsRes] =
      await Promise.all([
        sb.from("mystery_alibis").select("*").in("character_id", characterIds),
        sb
          .from("mystery_witness_statements")
          .select("*")
          .in("character_id", characterIds),
        sb
          .from("mystery_character_evidence")
          .select("*")
          .in("character_id", characterIds),
        sb
          .from("mystery_signature_clues")
          .select("*")
          .in("character_id", characterIds),
        sb
          .from("mystery_red_herrings")
          .select("*")
          .in("character_id", characterIds),
      ]);

    const byCharacter: Record<string, CharacterContext> = {};
    for (const id of characterIds) {
      const alibis: AlibiEntry[] = (alibisRes.data ?? [])
        .filter(
          (r) =>
            r.character_id === id || r.character_scope === "generic"
        )
        .map((r) => ({
          alibiId: r.alibi_id,
          characterScope: r.character_scope as "generic" | "specific",
          characterId: r.character_id,
          roomId: r.room_id,
          hour: r.hour,
          alibi: r.alibi,
        }));

      const witnesses: WitnessEntry[] = (witnessRes.data ?? [])
        .filter((r) => r.character_id === id)
        .map((r) => ({
          statementId: r.statement_id,
          characterId: r.character_id,
          statementType: r.statement_type as "true" | "false",
          statement: r.statement,
          aboutCharacter: r.about_character,
          hour: r.hour,
        }));

      const evidence: EvidenceEntry[] = (evidenceRes.data ?? [])
        .filter((r) => r.character_id === id)
        .map((r) => ({
          evidenceId: r.evidence_id,
          characterId: r.character_id,
          evidence: r.evidence,
          locationFound: r.location_found,
          forensicNote: r.forensic_note,
        }));

      const allClues: SignatureClue[] = (cluesRes.data ?? [])
        .filter((r) => r.character_id === id)
        .map((r) => ({
          clueId: r.clue_id,
          characterId: r.character_id,
          clue: r.clue,
          roomFound: r.room_found,
          misleading: r.misleading === "true",
        }));
      const clues = pickN(allClues, 2, rng);

      const allHerrings: RedHerring[] = (herringsRes.data ?? [])
        .filter((r) => r.character_id === id)
        .map((r) => ({
          redHerringId: r.red_herring_id,
          characterId: r.character_id,
          redHerring: r.red_herring,
          apparentImplication: r.apparent_implication,
          trueExplanation: r.true_explanation,
        }));
      const redHerrings = pickN(allHerrings, 1, rng);

      byCharacter[id] = { alibis, witnesses, evidence, clues, redHerrings };
    }

    return { byCharacter, loaded: true };
  } catch {
    return { byCharacter: {}, loaded: false };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/mysteryEnrich.ts
git commit -m "feat: add enrichCase() pulling alibi/witness/evidence from Supabase"
```

---

## Task 6: Create `frontend/components/MysteryCharacterTooltip.tsx` — shared hover tooltip

A `<TooltipWrapper>` that wraps any element and shows a floating panel on hover with name, title, trait, quirk, and relationship-to-victim. Used in all three investigation tabs.

**Files:**
- Create: `frontend/components/MysteryCharacterTooltip.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Character, MysteryCase } from "@/lib/mystery";
import { pretty } from "@/lib/mystery";
import type { MysteryContext } from "@/lib/mysteryTypes";

export function TooltipWrapper({
  character,
  mystery,
  context,
  children,
}: {
  character: Character;
  mystery: MysteryCase;
  context: MysteryContext;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  const dossier = mystery.dossiers[character.id];
  const rel = dossier?.relationships.find((r) => r.to === mystery.victim.id);
  const relLabel = rel ? rel.kind : "Unknown connection";

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-left shadow-xl"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{character.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-ink">{pretty(character.id)}</p>
                <p className="microlabel text-gold">{character.title}</p>
              </div>
            </div>
            <p className="mt-2 text-xs italic text-muted">{character.trait}</p>
            <p className="mt-1 text-xs text-ink/70">{character.quirk}</p>
            <div className="mt-2 border-t border-line pt-2">
              <p className="microlabel text-muted">to victim</p>
              <p className="text-xs capitalize text-ink">{relLabel}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/MysteryCharacterTooltip.tsx
git commit -m "feat: add MysteryCharacterTooltip shared hover component"
```

---

## Task 7: Create `frontend/components/MysteryAlibiTracker.tsx` — full-width alibi table

Full-width Suspect × Hours table. Two stacked pills per cell (location + alibi text). Colored reliability dots. Auto-mark toggle. Footer counts.

**Files:**
- Create: `frontend/components/MysteryAlibiTracker.tsx`

**Dot color rules:**
- **Green** (`#2a6e3a`): another suspect's `WitnessEntry` places this character at this hour (`about_character === suspectId && statement_type === "true" && hour === hourLabel`)
- **Gold** (`#C9A24A`): this character's own `WitnessEntry` has a true statement for this hour (`character_id === suspectId && statement_type === "true" && hour === hourLabel`)
- **Red** (`#8b1a1a`): neither

The murder-hour column header gets ember underline once `deductionMatrix` has a confirmed cell in that column.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useMemo } from "react";
import { HOURS, deductionMatrix, type MysteryCase } from "@/lib/mystery";
import type { MysteryContext } from "@/lib/mysteryTypes";
import MysteryStatusPill, { type SuspectTag } from "./MysteryStatusPill";
import { TooltipWrapper } from "./MysteryCharacterTooltip";

function dotColor(
  suspectId: string,
  hourIndex: number,
  mystery: MysteryCase,
  context: MysteryContext
): "gold" | "green" | "red" {
  if (!context.loaded) return "red";
  const charCtx = context.byCharacter[suspectId];
  if (!charCtx) return "red";
  const hourLabel = HOURS[hourIndex];

  const crossConfirmed = mystery.suspects.some((other) => {
    if (other.id === suspectId) return false;
    const otherCtx = context.byCharacter[other.id];
    return otherCtx?.witnesses.some(
      (w) =>
        w.aboutCharacter === suspectId &&
        w.statementType === "true" &&
        w.hour === hourLabel
    );
  });
  if (crossConfirmed) return "green";

  const selfCorroborated = charCtx.witnesses.some(
    (w) => w.statementType === "true" && w.hour === hourLabel
  );
  return selfCorroborated ? "gold" : "red";
}

const DOT_CLASS: Record<"gold" | "green" | "red", string> = {
  gold: "bg-amber-400",
  green: "bg-green-600",
  red: "bg-red-800",
};

export default function MysteryAlibiTracker({
  mystery,
  context,
  cluesRevealed,
  tags,
  onCycleTag,
  onAutoMark,
  autoMarkUsed,
}: {
  mystery: MysteryCase;
  context: MysteryContext;
  cluesRevealed: number;
  tags: Record<string, SuspectTag>;
  onCycleTag: (id: string) => void;
  onAutoMark: () => void;
  autoMarkUsed: boolean;
}) {
  const matrix = useMemo(
    () => deductionMatrix(mystery, cluesRevealed),
    [mystery, cluesRevealed]
  );

  const confirmedHour = useMemo(() => {
    for (let h = 0; h < HOURS.length; h++) {
      if (matrix.some((row) => row[h] === "confirmed")) return h;
    }
    return null;
  }, [matrix]);

  const cleared = Object.values(tags).filter((t) => t === "cleared").length;
  const potential = Object.values(tags).filter((t) => t === "potential").length;
  const prime = Object.values(tags).filter((t) => t === "prime").length;

  const unverified = useMemo(() => {
    let count = 0;
    for (const s of mystery.suspects) {
      for (let h = 0; h < HOURS.length; h++) {
        if (dotColor(s.id, h, mystery, context) === "red") count++;
      }
    }
    return count;
  }, [mystery, context]);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={onAutoMark}
          disabled={autoMarkUsed}
          className={`microlabel flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition ${
            autoMarkUsed
              ? "cursor-default border-line text-muted opacity-50"
              : "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
          }`}
        >
          ⚡ Auto-mark{autoMarkUsed ? " (used −150pts)" : ""}
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="microlabel px-3 py-2 text-left text-muted">
                Suspect
              </th>
              {HOURS.map((hour, h) => (
                <th
                  key={hour}
                  className={`microlabel px-3 py-2 text-center ${
                    confirmedHour === h
                      ? "text-ember underline decoration-ember/60 underline-offset-4"
                      : "text-muted"
                  }`}
                >
                  {hour}
                </th>
              ))}
              <th className="microlabel px-3 py-2 text-center text-muted">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {mystery.suspects.map((suspect) => (
              <tr key={suspect.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <TooltipWrapper
                    character={suspect}
                    mystery={mystery}
                    context={context}
                  >
                    <div className="flex cursor-default items-center gap-2">
                      <span className="text-xl">{suspect.emoji}</span>
                      <span className="display text-sm text-ink">
                        {suspect.id
                          .split("-")
                          .map((p) => p[0].toUpperCase() + p.slice(1))
                          .join(" ")}
                      </span>
                    </div>
                  </TooltipWrapper>
                </td>
                {HOURS.map((hour, h) => {
                  const room = mystery.dossiers[suspect.id].claimed[h];
                  const dot = dotColor(suspect.id, h, mystery, context);
                  const alibiEntry = context.loaded
                    ? context.byCharacter[suspect.id]?.alibis.find(
                        (a) => a.roomId === room && a.hour === hour
                      )
                    : undefined;
                  return (
                    <td key={hour} className="px-2 py-2 align-top">
                      <div className="flex min-w-[100px] flex-col gap-1">
                        <div className="flex items-start gap-1">
                          <span
                            className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${DOT_CLASS[dot]}`}
                          />
                          <span className="rounded bg-surface/80 px-1.5 py-0.5 text-xs italic text-muted">
                            {room.replace(/^the /, "")}
                          </span>
                        </div>
                        <div className="flex items-start gap-1">
                          <span
                            className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${DOT_CLASS[dot]}`}
                          />
                          <span className="rounded bg-surface/40 px-1.5 py-0.5 text-xs text-ink/70">
                            {alibiEntry ? alibiEntry.alibi : "???"}
                          </span>
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center">
                  <MysteryStatusPill
                    tag={tags[suspect.id]}
                    onCycle={() => onCycleTag(suspect.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <td colSpan={HOURS.length + 2} className="px-3 py-2">
                <p className="microlabel text-muted">
                  CLEARED: {cleared} · POTENTIAL: {potential} · PRIME: {prime}{" "}
                  · UNVERIFIED ALIBIS: {unverified}
                </p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/MysteryAlibiTracker.tsx
git commit -m "feat: add MysteryAlibiTracker full-width suspect×hours table"
```

---

## Task 8: Create `frontend/components/MysteryMapView.tsx` — mansion map with animated characters

Mansion photo as background. SVG/absolute emoji overlays for each character. Horizontal timeline scrubber at bottom. Characters animate between rooms as the scrubber moves. Framer Motion `layoutId` drives the transitions.

**Files:**
- Create: `frontend/components/MysteryMapView.tsx`

**Note:** The user must save `frontend/public/mansion-map.jpg`. Until that file exists, a dark placeholder div is shown instead of the image.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useMemo, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { HOURS, type MysteryCase } from "@/lib/mystery";
import type { MysteryContext } from "@/lib/mysteryTypes";
import { TooltipWrapper } from "./MysteryCharacterTooltip";

// Room center positions as % of the container (match mansion-map.jpg layout)
// These percentages target the visual center of each room in the image.
// Adjust after the image is in place.
const ROOM_CENTERS: Record<string, { cx: number; cy: number }> = {
  "the Observatory":    { cx: 50, cy: 22 },
  "the Smoking Lounge": { cx: 13, cy: 37 },
  "the Conservatory":   { cx: 87, cy: 37 },
  "the Grand Ballroom": { cx: 50, cy: 53 },
  "the Velvet Library": { cx: 13, cy: 67 },
  "the Wine Cellar":    { cx: 87, cy: 67 },
};

function polygonPositions(
  n: number,
  cx: number,
  cy: number,
  r: number
): [number, number][] {
  if (n === 1) return [[cx, cy]];
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [
      number,
      number
    ];
  });
}

export default function MysteryMapView({
  mystery,
  context,
  verdictSubmitted,
}: {
  mystery: MysteryCase;
  context: MysteryContext;
  verdictSubmitted?: boolean;
}) {
  const [selectedHour, setSelectedHour] = useState(0);

  // Group suspects by room for the selected hour
  const roomGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const s of mystery.suspects) {
      const room = mystery.dossiers[s.id].claimed[selectedHour];
      if (!groups[room]) groups[room] = [];
      groups[room].push(s.id);
    }
    return groups;
  }, [mystery, selectedHour]);

  // Compute final position for each suspect
  const positions = useMemo(() => {
    const result: Record<string, { x: number; y: number }> = {};
    for (const [room, ids] of Object.entries(roomGroups)) {
      const center = ROOM_CENTERS[room] ?? { cx: 50, cy: 50 };
      const pts = polygonPositions(ids.length, center.cx, center.cy, 5);
      ids.forEach((id, i) => {
        result[id] = { x: pts[i][0], y: pts[i][1] };
      });
    }
    return result;
  }, [roomGroups]);

  return (
    <div className="w-full space-y-4">
      {/* Map container */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-bg/60">
        <img
          src="/mansion-map.jpg"
          alt="Mansion floor plan"
          className="w-full"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Fallback placeholder shown when image is absent */}
        <div className="absolute inset-0 -z-10 bg-surface/80" />

        <LayoutGroup>
          {mystery.suspects.map((suspect) => {
            const pos = positions[suspect.id];
            if (!pos) return null;
            const isCulprit = mystery.culprits.includes(suspect.id);
            const glowing =
              verdictSubmitted && isCulprit && selectedHour === mystery.hourIndex;
            return (
              <motion.div
                key={suspect.id}
                layoutId={`mystery-map-char-${suspect.id}`}
                style={{
                  position: "absolute",
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                transition={{ type: "spring", stiffness: 180, damping: 28 }}
              >
                <TooltipWrapper
                  character={suspect}
                  mystery={mystery}
                  context={context}
                >
                  <div
                    className={`cursor-pointer text-2xl select-none ${
                      glowing
                        ? "animate-pulse drop-shadow-[0_0_8px_rgba(220,80,60,0.9)]"
                        : ""
                    }`}
                  >
                    {suspect.emoji}
                  </div>
                </TooltipWrapper>
              </motion.div>
            );
          })}
        </LayoutGroup>
      </div>

      {/* Timeline scrubber */}
      <div className="px-2">
        <div className="mb-2 flex justify-between">
          {HOURS.map((hour, h) => (
            <span
              key={hour}
              className={`microlabel cursor-pointer ${
                selectedHour === h ? "text-gold" : "text-muted"
              }`}
              onClick={() => setSelectedHour(h)}
            >
              {hour}
            </span>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={HOURS.length - 1}
          value={selectedHour}
          onChange={(e) => setSelectedHour(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-amber-400"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/MysteryMapView.tsx
git commit -m "feat: add MysteryMapView mansion map with animated character timeline"
```

---

## Task 9: Create `frontend/components/MysteryRelationshipMap.tsx` — radial web

Victim at center of an SVG, 7 suspects on the circumference. Colored SVG lines for relationships. Hover dims unrelated lines and shows tooltip; click selects a character.

**Design note:** Character emojis are rendered as absolute-positioned `div`s overlaid on the SVG (not as SVG `<text>`) so that `TooltipWrapper` (which uses DOM hover events) works correctly.

**Files:**
- Create: `frontend/components/MysteryRelationshipMap.tsx`

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useState } from "react";
import type { MysteryCase } from "@/lib/mystery";
import { pretty } from "@/lib/mystery";
import type { MysteryContext } from "@/lib/mysteryTypes";
import { TooltipWrapper } from "./MysteryCharacterTooltip";

const SVG_SIZE = 500;
const CENTER = SVG_SIZE / 2;
const RADIUS = 185;
const NODE_R = 22;

function relColor(kind: string): string {
  if (kind === "rival" || kind === "secret-keeper") return "rgba(110,31,43,0.6)";
  if (kind === "old flame") return "rgba(42,95,90,0.6)";
  return "rgba(201,162,74,0.6)";
}

export default function MysteryRelationshipMap({
  mystery,
  context,
}: {
  mystery: MysteryCase;
  context: MysteryContext;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const suspects = mystery.suspects;

  // Circumference positions (x, y in SVG coordinates)
  const nodePos = suspects.map((s, i) => {
    const angle = (2 * Math.PI * i) / suspects.length - Math.PI / 2;
    return {
      id: s.id,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    };
  });
  const posMap = Object.fromEntries(nodePos.map((p) => [p.id, p]));

  // Relationship kind from victim to suspect (via ringleader edge or dossier)
  function victimRelKind(suspectId: string): string {
    if (mystery.culprits[0] === suspectId) return "rival";
    const dossier = mystery.dossiers[suspectId];
    const rel = dossier?.relationships.find((r) => r.to === mystery.victim.id);
    return rel?.kind ?? "business partner";
  }

  function isActive(id: string): boolean {
    if (!selected) return true;
    return selected === id;
  }

  function edgeActive(fromId: string, toId: string): boolean {
    if (!selected) return false;
    return selected === fromId || selected === toId;
  }

  return (
    <div className="relative w-full">
      {/* SVG layer — lines only */}
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full"
        style={{ maxHeight: 500 }}
      >
        <defs>
          <filter id="rel-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Between-suspect relationship lines */}
        {suspects.flatMap((s) =>
          mystery.dossiers[s.id].relationships
            .filter((r) => posMap[r.to])
            .map((rel) => {
              const from = posMap[s.id];
              const to = posMap[rel.to];
              const active = edgeActive(s.id, rel.to);
              return (
                <line
                  key={`${s.id}→${rel.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={relColor(rel.kind)}
                  strokeWidth={active ? 2 : 1}
                  opacity={selected ? (active ? 0.75 : 0.07) : 0.15}
                  filter={active ? "url(#rel-glow)" : undefined}
                />
              );
            })
        )}

        {/* Victim → suspect spokes */}
        {nodePos.map((pos) => {
          const kind = victimRelKind(pos.id);
          const active = !selected || selected === pos.id;
          return (
            <line
              key={`victim→${pos.id}`}
              x1={CENTER}
              y1={CENTER}
              x2={pos.x}
              y2={pos.y}
              stroke={relColor(kind)}
              strokeWidth={active ? 2.5 : 1}
              opacity={selected ? (selected === pos.id ? 0.9 : 0.08) : 0.5}
              filter={selected === pos.id ? "url(#rel-glow)" : undefined}
            />
          );
        })}

        {/* Victim circle at center */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={NODE_R + 6}
          fill="rgba(20,16,12,0.9)"
          stroke="rgba(201,162,74,0.8)"
          strokeWidth={2}
        />

        {/* Suspect ring circles */}
        {nodePos.map((pos) => (
          <circle
            key={`circle-${pos.id}`}
            cx={pos.x}
            cy={pos.y}
            r={NODE_R}
            fill="rgba(20,16,12,0.9)"
            stroke={isActive(pos.id) ? "rgba(201,162,74,0.4)" : "rgba(80,70,60,0.2)"}
            strokeWidth={1.5}
            style={{ cursor: "pointer" }}
            onClick={() =>
              setSelected(selected === pos.id ? null : pos.id)
            }
          />
        ))}
      </svg>

      {/* Emoji overlays (absolute-positioned divs so TooltipWrapper works) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ aspectRatio: "1 / 1" }}
      >
        {/* Victim at center */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl select-none"
          style={{ left: "50%", top: "50%" }}
        >
          {mystery.victim.emoji}
        </div>

        {/* Suspects on circumference */}
        {nodePos.map((pos) => {
          const suspect = suspects.find((s) => s.id === pos.id)!;
          const xPct = (pos.x / SVG_SIZE) * 100;
          const yPct = (pos.y / SVG_SIZE) * 100;
          return (
            <div
              key={`emoji-${pos.id}`}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                opacity: isActive(pos.id) ? 1 : 0.35,
                transition: "opacity 0.15s",
              }}
              onClick={() =>
                setSelected(selected === pos.id ? null : pos.id)
              }
            >
              <TooltipWrapper
                character={suspect}
                mystery={mystery}
                context={context}
              >
                <span className="cursor-pointer select-none text-xl">
                  {suspect.emoji}
                </span>
              </TooltipWrapper>
            </div>
          );
        })}
      </div>

      {/* Selected character label */}
      {selected && (
        <div className="mt-2 text-center">
          <p className="microlabel text-gold">{pretty(selected)}</p>
          <p className="text-xs text-muted">
            {victimRelKind(selected)} to victim
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/MysteryRelationshipMap.tsx
git commit -m "feat: add MysteryRelationshipMap radial SVG relationship web"
```

---

## Task 10: Rewrite `frontend/components/MysteryInvestigate.tsx` — three-tab nav

Replace the `viewMode: "table" | "book"` toggle with three full-width tabs. Load `MysteryContext` via `enrichCase` on mount. Wire `autoMarkUsed` state and `handleAutoMark` handler. Remove all references to `MysteryDossierTable` and `MysteryDossierBook`.

**Files:**
- Modify: `frontend/components/MysteryInvestigate.tsx`

- [ ] **Step 1: Replace the entire file with the new implementation**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sfxCorrect, sfxGlassClink, sfxPianoChord, sfxWrong } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { deductionMatrix, HOURS, seedFromDate, type MysteryCase } from "@/lib/mystery";
import { mulberry32 } from "@/lib/rng";
import { enrichCase } from "@/lib/mysteryEnrich";
import type { MysteryContext } from "@/lib/mysteryTypes";
import { score, type MysteryAttempt, type MysteryScoreResult } from "@/lib/mysteryScore";
import MysteryEvidenceLog from "./MysteryEvidenceLog";
import MysteryAccusationForm from "./MysteryAccusationForm";
import MysteryAlibiTracker from "./MysteryAlibiTracker";
import MysteryMapView from "./MysteryMapView";
import MysteryRelationshipMap from "./MysteryRelationshipMap";
import { nextTag, type SuspectTag } from "./MysteryStatusPill";
import AchievementToast from "./AchievementToast";

export interface StoredMysteryAttempt {
  attempt: MysteryAttempt;
  result: MysteryScoreResult;
  at: number;
}

type MainTab = "relationship-map" | "alibi-tracker" | "map-view";
type MobileTab = "relationship-map" | "alibi-tracker" | "map-view" | "evidence";

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: "relationship-map", label: "⬡ Relationship Map" },
  { key: "alibi-tracker",   label: "⊞ Alibi Tracker" },
  { key: "map-view",        label: "≡ Map View" },
];

export default function MysteryInvestigate({
  mystery,
  onSolved,
}: {
  mystery: MysteryCase;
  onSolved: (stored: StoredMysteryAttempt) => void;
}) {
  const { record } = useProfile();
  const [cluesRevealed, setCluesRevealed] = useState(1);
  const [tags, setTags] = useState<Record<string, SuspectTag>>({});
  const [whereGuess, setWhereGuess] = useState<string | null>(null);
  const [whenGuess, setWhenGuess] = useState<number | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("alibi-tracker");
  const [mobileTab, setMobileTab] = useState<MobileTab>("alibi-tracker");
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [context, setContext] = useState<MysteryContext>({ byCharacter: {}, loaded: false });
  const [autoMarkUsed, setAutoMarkUsed] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const rnd = mulberry32(seedFromDate(mystery.date));
    enrichCase(mystery, rnd).then(setContext);
  }, [mystery.date]);

  const whoGuess = useMemo(
    () => mystery.suspects.filter((s) => tags[s.id] === "prime").map((s) => s.id),
    [mystery.suspects, tags]
  );

  function cycleTag(id: string) {
    setTags((t) => ({ ...t, [id]: nextTag(t[id]) }));
    sfxGlassClink();
  }

  function revealNext() {
    setCluesRevealed((r) => Math.min(mystery.clues.length, r + 1));
    sfxPianoChord();
  }

  function handleAutoMark() {
    if (autoMarkUsed) return;
    const matrix = deductionMatrix(mystery, cluesRevealed);
    let confirmedHourIdx: number | null = null;
    for (let h = 0; h < HOURS.length; h++) {
      if (matrix.some((row) => row[h] === "confirmed")) {
        confirmedHourIdx = h;
        break;
      }
    }
    setTags((prev) => {
      const next = { ...prev };
      for (const s of mystery.suspects) {
        const allVerified = HOURS.every((_, h) => {
          if (!context.loaded) return false;
          const charCtx = context.byCharacter[s.id];
          if (!charCtx) return false;
          const hourLabel = HOURS[h];
          const selfCorroborated = charCtx.witnesses.some(
            (w) => w.statementType === "true" && w.hour === hourLabel
          );
          const crossConfirmed = mystery.suspects.some((other) => {
            if (other.id === s.id) return false;
            return context.byCharacter[other.id]?.witnesses.some(
              (w) =>
                w.aboutCharacter === s.id &&
                w.statementType === "true" &&
                w.hour === hourLabel
            );
          });
          return selfCorroborated || crossConfirmed;
        });
        if (allVerified) {
          next[s.id] = "cleared";
          continue;
        }
        if (confirmedHourIdx !== null) {
          const hourLabel = HOURS[confirmedHourIdx];
          const charCtx = context.byCharacter[s.id];
          const hasWitness =
            charCtx?.witnesses.some(
              (w) => w.statementType === "true" && w.hour === hourLabel
            ) ||
            mystery.suspects.some((other) => {
              if (other.id === s.id) return false;
              return context.byCharacter[other.id]?.witnesses.some(
                (w) =>
                  w.aboutCharacter === s.id &&
                  w.statementType === "true" &&
                  w.hour === hourLabel
              );
            });
          if (!hasWitness) next[s.id] = "potential";
        }
      }
      return next;
    });
    setAutoMarkUsed(true);
  }

  function submit() {
    const elapsedSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    const attempt: MysteryAttempt = {
      whoGuess,
      whereGuess,
      whenGuess,
      cluesRevealed,
      elapsedSeconds,
      tableTags: tags,
      autoMarkUsed,
    };
    const result = score(mystery, attempt);
    if (result.won) {
      sfxCorrect();
      haptic.win();
    } else {
      sfxWrong();
      haptic.wrong();
    }
    const unlocked = record({
      room: "mystery",
      score: result.total,
      correct: result.won ? 1 : 0,
      total: 1,
    });
    if (unlocked.length) setToasts(unlocked);
    onSolved({ attempt, result, at: Date.now() });
  }

  function renderMainTab(tab: MainTab) {
    if (tab === "relationship-map") {
      return (
        <MysteryRelationshipMap mystery={mystery} context={context} />
      );
    }
    if (tab === "alibi-tracker") {
      return (
        <MysteryAlibiTracker
          mystery={mystery}
          context={context}
          cluesRevealed={cluesRevealed}
          tags={tags}
          onCycleTag={cycleTag}
          onAutoMark={handleAutoMark}
          autoMarkUsed={autoMarkUsed}
        />
      );
    }
    return (
      <MysteryMapView mystery={mystery} context={context} />
    );
  }

  const evidencePanel = (
    <>
      <MysteryEvidenceLog
        mystery={mystery}
        cluesRevealed={cluesRevealed}
        onRevealNext={revealNext}
      />
      <MysteryAccusationForm
        mystery={mystery}
        whoGuess={whoGuess}
        whereGuess={whereGuess}
        whenGuess={whenGuess}
        onWhereChange={setWhereGuess}
        onWhenChange={setWhenGuess}
        onSubmit={submit}
      />
    </>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-baseline justify-between">
        <h2 className="display gilt text-3xl">{mystery.title}</h2>
        <span className="microlabel text-brass">case #{mystery.caseNumber}</span>
      </div>

      {/* Desktop layout: full-width tab panel + right sidebar */}
      <div className="mt-6 hidden lg:flex lg:gap-6">
        <div className="min-w-0 flex-1">
          {/* Tab bar */}
          <div className="mb-4 flex gap-2">
            {MAIN_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setMainTab(t.key)}
                className={`microlabel rounded-full border px-4 py-1.5 transition ${
                  mainTab === t.key
                    ? "border-gold text-gold"
                    : "border-line text-muted hover:border-gold/40 hover:text-gold/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="gilt-frame rounded-2xl bg-surface/60 p-5">
            {renderMainTab(mainTab)}
          </div>
        </div>
        <div className="w-72 flex-shrink-0">
          <div className="flex flex-col gap-6">{evidencePanel}</div>
        </div>
      </div>

      {/* Mobile: tabs including evidence */}
      <div className="mt-6 lg:hidden">
        <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
          {([...MAIN_TABS, { key: "evidence" as const, label: "Evidence" }]).map((t) => (
            <button
              key={t.key}
              onClick={() => setMobileTab(t.key as MobileTab)}
              className={`microlabel flex-shrink-0 rounded-full border px-3 py-2 ${
                mobileTab === t.key
                  ? "border-gold text-gold"
                  : "border-line text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {mobileTab === "evidence" ? (
          <div className="flex flex-col gap-6">{evidencePanel}</div>
        ) : (
          <div className="gilt-frame rounded-2xl bg-surface/60 p-4">
            {renderMainTab(mobileTab as MainTab)}
          </div>
        )}
      </div>

      <AchievementToast queue={toasts} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: no new errors. The old imports of `MysteryDossierTable` and `MysteryDossierBook` are gone; those files still exist but are no longer imported — that's fine until Task 12.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test 2>&1 | tail -10
```
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/MysteryInvestigate.tsx
git commit -m "feat: rewrite MysteryInvestigate with three-tab layout and Supabase enrichment"
```

---

## Task 11: Fix `frontend/components/MysteryAccusationForm.tsx` — capitalize room labels

Room values like `"the Velvet Library"` display with a lowercase "the". This fix capitalizes the leading article.

**Files:**
- Modify: `frontend/components/MysteryAccusationForm.tsx`

- [ ] **Step 1: Add the `displayRoom` helper and apply it**

After the imports, add one helper function before the component:

```tsx
function displayRoom(r: string): string {
  return r.replace(/^the /, "The ");
}
```

Then in the `<option>` for rooms, change:
```tsx
<option key={room} value={room}>
  {room}
</option>
```
to:
```tsx
<option key={room} value={room}>
  {displayRoom(room)}
</option>
```

The full updated file:

```tsx
"use client";

import { HOURS, ROOMS, type MysteryCase } from "@/lib/mystery";

function displayRoom(r: string): string {
  return r.replace(/^the /, "The ");
}

export default function MysteryAccusationForm({
  mystery,
  whoGuess,
  whereGuess,
  whenGuess,
  onWhereChange,
  onWhenChange,
  onSubmit,
}: {
  mystery: MysteryCase;
  whoGuess: string[];
  whereGuess: string | null;
  whenGuess: number | null;
  onWhereChange: (room: string) => void;
  onWhenChange: (hourIndex: number) => void;
  onSubmit: () => void;
}) {
  const canSubmit = whoGuess.length > 0 && whereGuess !== null && whenGuess !== null;

  return (
    <div className="gilt-frame mt-6 rounded-2xl bg-surface/60 p-5">
      <p className="microlabel mb-3 text-gold">submit accusation</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="microlabel mb-1 text-muted">who</p>
          <div className="rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm text-ink/80">
            {whoGuess.length > 0 ? `${whoGuess.length} marked PRIME` : "tag suspects PRIME"}
          </div>
        </div>
        <div>
          <p className="microlabel mb-1 text-muted">where</p>
          <select
            value={whereGuess ?? ""}
            onChange={(e) => onWhereChange(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm text-ink"
          >
            <option value="" disabled>
              room
            </option>
            {ROOMS.map((room) => (
              <option key={room} value={room}>
                {displayRoom(room)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="microlabel mb-1 text-muted">when</p>
          <select
            value={whenGuess ?? ""}
            onChange={(e) => onWhenChange(Number(e.target.value))}
            className="w-full rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm text-ink"
          >
            <option value="" disabled>
              hour
            </option>
            {HOURS.map((hour, i) => (
              <option key={hour} value={i}>
                {hour}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="microlabel mt-4 w-full rounded-full border border-ember py-3 text-ember transition enabled:hover:bg-ember enabled:hover:text-ink disabled:opacity-40"
      >
        submit verdict
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/MysteryAccusationForm.tsx
git commit -m "fix: capitalize room labels in accusation dropdown"
```

---

## Task 12: Update `frontend/components/MysteryVerdict.tsx` — procedural verdict message

Replace the three hardcoded strings with a `verdictSummary()` function that generates prose based on what the player actually got right or wrong.

**Files:**
- Modify: `frontend/components/MysteryVerdict.tsx`

- [ ] **Step 1: Add the `verdictSummary` helper and replace the hardcoded `<p>` text**

The full updated file:

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { HOURS, pretty, type MysteryCase } from "@/lib/mystery";
import {
  shareText,
  type MysteryAttempt,
  type MysteryScoreResult,
} from "@/lib/mysteryScore";

function verdictSummary(
  mystery: MysteryCase,
  attempt: MysteryAttempt,
  result: MysteryScoreResult
): string {
  const culpritSet = new Set(mystery.culprits);
  const guessSet = new Set(attempt.whoGuess);
  const whoCorrect =
    guessSet.size === culpritSet.size &&
    [...guessSet].every((id) => culpritSet.has(id));
  const whereCorrect = attempt.whereGuess === mystery.scene;
  const whenCorrect = attempt.whenGuess === mystery.hourIndex;
  const gotRingleader = attempt.whoGuess.includes(mystery.culprits[0]);
  const gotAccomplice =
    mystery.culprits.length > 1 &&
    attempt.whoGuess.some(
      (id) => mystery.culprits.includes(id) && id !== mystery.culprits[0]
    );

  const ring = pretty(mystery.culprits[0]);
  const trueHour = HOURS[mystery.hourIndex];
  const guessedHour =
    attempt.whenGuess !== null ? HOURS[attempt.whenGuess] : "an unknown hour";
  const trueScene = mystery.scene;

  if (result.won) {
    return "Flawless. You named every culprit, the exact room, and the precise hour. The Order is satisfied.";
  }
  if (whoCorrect && whereCorrect && !whenCorrect) {
    return `You knew who and where — but the hour eluded you. The crime happened at ${trueHour}, not ${guessedHour}.`;
  }
  if (whoCorrect && !whereCorrect && whenCorrect) {
    return `You had the right suspects and the right hour, but the wrong room. It happened in ${trueScene}.`;
  }
  if (whoCorrect && !whereCorrect && !whenCorrect) {
    return "You named the right culprit, but the room and hour were both wrong.";
  }
  if (gotRingleader && !whoCorrect) {
    const missed = mystery.culprits
      .filter((id) => !guessSet.has(id))
      .map((id) => pretty(id));
    return `You found the ringleader (${ring}), but ${missed.join(", ")} walked free.`;
  }
  if (!gotRingleader && gotAccomplice) {
    return `You caught an accomplice but the ringleader (${ring}) slipped away.`;
  }
  return `${ring} was the ringleader. They were in ${trueScene} at ${trueHour}.`;
}

export default function MysteryVerdict({
  mystery,
  attempt,
  result,
}: {
  mystery: MysteryCase;
  attempt: MysteryAttempt;
  result: MysteryScoreResult;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = shareText(mystery, attempt, result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="mx-auto max-w-2xl text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="candle-pool"
      >
        <p className="microlabel text-brass">
          the verdict · case #{mystery.caseNumber}
        </p>
        <h1 className={`display mt-2 text-6xl ${result.won ? "gilt" : "text-ember"}`}>
          {result.won ? "Case Closed" : "Cold Case"}
        </h1>
      </motion.div>
      <p className="mt-4 text-muted">{verdictSummary(mystery, attempt, result)}</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line bg-surface/60 p-3">
          <p className="microlabel text-muted">score</p>
          <p className="display tabular mt-1 text-2xl">{result.total}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface/60 p-3">
          <p className="microlabel text-muted">clues used</p>
          <p className="display tabular mt-1 text-2xl">
            {attempt.cluesRevealed}/{mystery.clues.length}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface/60 p-3">
          <p className="microlabel text-muted">time</p>
          <p className="display tabular mt-1 text-2xl">
            {Math.floor(attempt.elapsedSeconds / 60)}:
            {(attempt.elapsedSeconds % 60).toString().padStart(2, "0")}
          </p>
        </div>
      </div>

      <div className="gilt-frame mt-8 rounded-2xl bg-surface/70 p-6 text-left">
        <p className="microlabel text-gold">the truth</p>
        <div className="mt-3 space-y-2">
          {mystery.culprits.map((id, i) => {
            const c = mystery.suspects.find((s) => s.id === id)!;
            return (
              <div key={id} className="flex items-center gap-3">
                <span className="text-2xl">{c.emoji}</span>
                <span className="display text-lg">{pretty(id)}</span>
                <span className="microlabel text-muted">
                  {i === 0 ? "ringleader" : "accomplice"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
          <div>
            <p className="microlabel text-muted">motive</p>
            <p className="text-ink">{mystery.motive}</p>
          </div>
          <div>
            <p className="microlabel text-muted">scene</p>
            <p className="text-ink">{mystery.scene}</p>
          </div>
          <div>
            <p className="microlabel text-muted">hour</p>
            <p className="text-ink">{HOURS[mystery.hourIndex]}</p>
          </div>
        </div>
      </div>

      <button
        onClick={share}
        className="microlabel mt-6 w-full rounded-full border border-gold py-3 text-gold transition hover:bg-gold hover:text-bg"
      >
        {copied ? "copied to clipboard ✓" : "share result"}
      </button>
      <p className="mt-6 text-xs text-muted">
        A new case is dealt at midnight. Come back tomorrow.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/MysteryVerdict.tsx
git commit -m "fix: replace hardcoded verdict message with procedurally generated prose"
```

---

## Task 13: Delete old components and run full verification

Remove `MysteryDossierTable.tsx` and `MysteryDossierBook.tsx` (now replaced by the three-tab system), then run a full typecheck and test suite to confirm everything is clean.

**Files:**
- Delete: `frontend/components/MysteryDossierTable.tsx`
- Delete: `frontend/components/MysteryDossierBook.tsx`

- [ ] **Step 1: Delete the old files**

```bash
rm frontend/components/MysteryDossierTable.tsx frontend/components/MysteryDossierBook.tsx
```

- [ ] **Step 2: Confirm no remaining imports**

```bash
grep -r "MysteryDossierTable\|MysteryDossierBook" frontend/
```
Expected: no output (zero references).

- [ ] **Step 3: Run typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1
```
Expected: no errors (or only pre-existing errors that existed before this implementation).

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test 2>&1
```
Expected: all 14 tests pass (8 mystery + 6 mysteryScore).

- [ ] **Step 5: Commit**

```bash
git add -u frontend/components/MysteryDossierTable.tsx frontend/components/MysteryDossierBook.tsx
git commit -m "chore: delete MysteryDossierTable and MysteryDossierBook (replaced by three-tab view)"
```

---

## Done Criteria Checklist

- [ ] `frontend/.env.local` exists with `NEXT_PUBLIC_SUPABASE_*` vars
- [ ] `npm test` passes (all 14 tests)
- [ ] `npx tsc --noEmit` passes
- [ ] Three tabs render in MysteryInvestigate (Relationship Map, Alibi Tracker, Map View)
- [ ] Alibi Tracker shows 7 suspects × 5 hours; alibi text loads from Supabase (fallback `"???"` offline)
- [ ] Auto-mark sets verdict pills and registers −150 penalty on submit
- [ ] Map View shows mansion image (or dark placeholder) with emoji characters that animate on timeline drag
- [ ] Relationship Map shows victim + 7 suspects; hover tooltip works; click selects a character
- [ ] Accusation dropdown rooms show `"The Velvet Library"` (not `"the Velvet Library"`)
- [ ] Verdict message is procedurally specific (e.g. "You knew who and where — but the hour eluded you")
- [ ] No references to `MysteryDossierTable` or `MysteryDossierBook` anywhere in the codebase
