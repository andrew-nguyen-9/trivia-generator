// THE CLOCK logic layer. Instead of a blind year guess, each round ships 2–4
// deterministic clues that CONSTRAIN the answer to a bounded range — the player
// deduces within the bounds rather than guessing the whole century. Clues are
// derived lazily from the day's target year (no schema churn), seeded so SSR and
// client agree and every player on a date faces the same deduction.

import { mulberry32 } from "./rng";

export interface YearClue {
  /** the constraint, phrased for the player */
  text: string;
  /** lower bound this clue establishes (inclusive) */
  min: number;
  /** upper bound this clue establishes (inclusive) */
  max: number;
}

export interface ClockPuzzle {
  clues: YearClue[];
  /** the intersection of all clue ranges — the deducible window */
  min: number;
  max: number;
}

const FLOOR = 1800;

/**
 * Build a deterministic set of bounding clues for `target`. `seed` makes the
 * exact phrasing/decomposition stable per round per day. The returned window is
 * the intersection of every clue and always contains `target`.
 */
export function buildPuzzle(target: number, ceiling: number, seed: number): ClockPuzzle {
  const rand = mulberry32(seed >>> 0);
  const clues: YearClue[] = [];

  // 1) Half-century band — always present, the coarse frame.
  const halfLo = Math.floor((target - FLOOR) / 50) * 50 + FLOOR;
  const halfHi = Math.min(halfLo + 49, ceiling);
  clues.push({
    text: `It falls between ${halfLo} and ${halfHi}.`,
    min: halfLo,
    max: halfHi,
  });

  // 2) Parity of the year — narrows by deduction, not by giving a digit.
  if (target % 2 === 0) {
    clues.push({ text: "The year is even.", min: FLOOR, max: ceiling });
  } else {
    clues.push({ text: "The year is odd.", min: FLOOR, max: ceiling });
  }

  // 3) One half of the band excluded — picks a near-decade boundary.
  const mid = halfLo + 20 + Math.floor(rand() * 10); // 20..29 into the band
  if (target < mid) {
    clues.push({ text: `It is earlier than ${mid}.`, min: FLOOR, max: mid - 1 });
  } else {
    clues.push({ text: `It is no earlier than ${mid}.`, min: mid, max: ceiling });
  }

  // 4) Optional fourth clue (~half the time) — a divisibility tell that the
  //    player can reason against the already-narrowed window.
  if (rand() < 0.5) {
    const div = target % 4 === 0 ? 4 : target % 3 === 0 ? 3 : 0;
    if (div === 4) {
      clues.push({ text: "The year is a leap year (divisible by 4).", min: FLOOR, max: ceiling });
    } else if (div === 3) {
      clues.push({ text: "The year is divisible by 3.", min: FLOOR, max: ceiling });
    }
  }

  // Intersect every clue → the deducible window. Parity/divisibility clues span
  // the full range so they refine reasoning without collapsing the band; the
  // window stays honest (always contains target).
  const min = Math.max(FLOOR, ...clues.map((c) => c.min));
  const max = Math.min(ceiling, ...clues.map((c) => c.max));

  return { clues, min, max };
}
