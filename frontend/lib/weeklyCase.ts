// PARLOR v3 §3.23 — THE COLD CASE: a week-long, cross-room deduction.
//
// One unsolved case per week, the same for every member of the Order. A relic
// has gone missing from the Parlor; six suspects, each unique across four
// "tells". Seven days, seven clues — each NARRATED by a different room of the
// Order (the Codex, Chronos, Fractures…), so the case literally travels the
// house. A clue is always TRUE of the real culprit and removes at least one
// suspect; by the fifth day exactly one suspect survives every clue, so the
// case is provably solvable (see weeklyCase.test.ts). Days six and seven
// corroborate, for players who want certainty before the one accusation.
//
// Pure + date-seeded (mulberry32) so it's SSR-safe and identical for everyone,
// with NO database and NO cross-room data fetch — the "cross-room" hook is the
// narration, not a live query. Relative imports only: this file is consumed by
// the node-env vitest suite, which has no `@/` alias.
import { mulberry32, shuffled } from "./rng";

// Four independent dimensions. Each carries six distinct values so a pool of
// six suspects gets a unique value in every dimension — that uniqueness is what
// makes a single "the culprit is NOT <other's value>" clue eliminate exactly
// one suspect.
export type Dim = "suit" | "era" | "haunt" | "tell";

export const DIMS: Dim[] = ["suit", "era", "haunt", "tell"];

const VALUES: Record<Dim, string[]> = {
  suit: ["History ♦", "Music ♥", "Sports ♣", "Screen ♠", "Geography ✦", "Wildcard ✧"],
  era: [
    "Antiquity",
    "the Renaissance",
    "the Enlightenment",
    "the Belle Époque",
    "the Jazz Age",
    "the Atomic Age",
  ],
  haunt: [
    "the Codex",
    "the Clock Tower",
    "the Hall of Fractures",
    "the Atlas Room",
    "the Weaver's Loft",
    "the Séance Parlor",
  ],
  tell: [
    "a silver pocket-watch",
    "a raven's feather",
    "an ink-stained cuff",
    "a cracked monocle",
    "a brass skeleton key",
    "a crimson wax seal",
  ],
};

const SUSPECTS: { name: string; glyph: string }[] = [
  { name: "Mme. Ravenna", glyph: "♛" },
  { name: "Dr. Thorne", glyph: "♜" },
  { name: "Col. Ashby", glyph: "♞" },
  { name: "Sister Veil", glyph: "♝" },
  { name: "Mr. Crane", glyph: "♚" },
  { name: "Lady Voss", glyph: "♟" },
];

// The seven narrators, in week order. Each frames whatever clue lands on its
// day — the case walks one room per day.
const NARRATORS: { room: string; lead: string }[] = [
  { room: "Codex", lead: "The Codex's ledgers record that the culprit" },
  { room: "Chronos", lead: "The Clockkeeper testifies the culprit" },
  { room: "Fractures", lead: "In the shattered mirror, the culprit" },
  { room: "Ignite", lead: "By the open flame it is plain the culprit" },
  { room: "Atlas Obscura", lead: "The Cartographer charts that the culprit" },
  { room: "Thread of Fate", lead: "The Weaver's thread reveals the culprit" },
  { room: "Sanctum", lead: "The Sanctum's final reading confirms the culprit" },
];

export interface Suspect {
  name: string;
  glyph: string;
  attrs: Record<Dim, string>;
}

export interface Clue {
  day: number; // 1..7
  room: string; // narrating room
  dim: Dim;
  op: "is" | "not";
  value: string;
  text: string; // composed, player-facing
}

export interface WeeklyCase {
  weekSeed: number;
  suspects: Suspect[];
  culprit: number; // index into suspects
  relic: string;
  clues: Clue[]; // exactly 7, day-ordered
}

const RELICS = [
  "the Parlor's brass astrolabe",
  "the founder's death mask",
  "the velvet ledger of debts",
  "the cracked hourglass",
  "the Order's signet ring",
  "the midnight tarot deck",
];

/** True iff this suspect is consistent with the clue. The solver's predicate —
 *  the same logic the test uses to prove uniqueness. */
export function satisfies(s: Suspect, clue: Clue): boolean {
  return clue.op === "not" ? s.attrs[clue.dim] !== clue.value : s.attrs[clue.dim] === clue.value;
}

function phrase(op: "is" | "not", dim: Dim, value: string): string {
  const not = op === "not";
  switch (dim) {
    case "suit":
      return not ? `does not answer to the ${value} suit` : `answers to the ${value} suit`;
    case "era":
      return not ? `did not walk in ${value}` : `walked in ${value}`;
    case "haunt":
      return not ? `is never seen in ${value}` : `haunts ${value}`;
    case "tell":
      return not ? `does not carry ${value}` : `is known by ${value}`;
  }
}

/** Split a flat day-seed into a stable weekly bucket + the day within it.
 *  No calendar math: floor/mod over days-since-epoch gives every player the
 *  same 7-day window and the same position in it. dayIndex is 0..6. */
export function weeklyBucket(dayNum: number): { weekSeed: number; dayIndex: number } {
  const dayIndex = ((dayNum % 7) + 7) % 7;
  return { weekSeed: Math.floor(dayNum / 7), dayIndex };
}

/** Build the full week's case for a weekly bucket. Deterministic in weekSeed. */
export function buildWeeklyCase(weekSeed: number): WeeklyCase {
  // Salt the seed so adjacent weeks look unrelated.
  const rand = mulberry32((weekSeed ^ 0x5eed1e) >>> 0);

  // Assign each suspect a unique value per dimension by zipping a shuffled
  // value list onto the suspect list.
  const suspects: Suspect[] = SUSPECTS.map((s) => ({ ...s, attrs: {} as Record<Dim, string> }));
  for (const dim of DIMS) {
    const order = shuffled(VALUES[dim], rand);
    suspects.forEach((s, i) => {
      s.attrs[dim] = order[i];
    });
  }

  const culprit = Math.floor(rand() * suspects.length);
  const relic = RELICS[Math.floor(rand() * RELICS.length)];
  const guilty = suspects[culprit];

  // Elimination phase: one "not" clue per other suspect, each removing exactly
  // that suspect (values are unique per dimension). Five clues ⇒ only the
  // culprit survives. Cycle dimensions for variety.
  const others = shuffled(
    suspects.map((_, i) => i).filter((i) => i !== culprit),
    rand,
  );
  const clues: Clue[] = [];
  others.forEach((otherIdx, i) => {
    const dim = DIMS[i % DIMS.length];
    const value = suspects[otherIdx].attrs[dim]; // differs from culprit ⇒ "not" is true of culprit
    clues.push(makeClue(clues.length, "not", dim, value));
  });

  // Corroboration phase (days 6–7): true "is" statements about the culprit in
  // two not-yet-used dimensions, padding the week to seven without breaking the
  // single-survivor guarantee.
  const usedDims = new Set(clues.map((c) => c.dim));
  const freeDims = DIMS.filter((d) => !usedDims.has(d));
  const padDims = [...freeDims, ...DIMS]; // free first, then any (always ≥2)
  for (let k = 0; clues.length < 7; k++) {
    const dim = padDims[k % padDims.length];
    clues.push(makeClue(clues.length, "is", dim, guilty.attrs[dim]));
  }

  return { weekSeed, suspects, culprit, relic, clues };

  function makeClue(idx: number, op: "is" | "not", dim: Dim, value: string): Clue {
    const narrator = NARRATORS[idx];
    return {
      day: idx + 1,
      room: narrator.room,
      dim,
      op,
      value,
      text: `${narrator.lead} ${phrase(op, dim, value)}.`,
    };
  }
}

/** Suspects still consistent with every clue up to (and including) `throughDay`
 *  (1..7). The live deduction state the UI and the test both rely on. */
export function survivors(c: WeeklyCase, throughDay: number): number[] {
  const active = c.clues.filter((cl) => cl.day <= throughDay);
  return c.suspects
    .map((_, i) => i)
    .filter((i) => active.every((cl) => satisfies(c.suspects[i], cl)));
}
