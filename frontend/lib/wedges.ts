// THE WEDGES — pure, date-deterministic logic layer (no I/O, no Math.random).
//
// The headline guarantee: two players on the same date face the SAME questions
// per category in the SAME index order (so results are comparable). We build
// that order from `dailyOrder` in lib/rng.ts, keyed by category + daySeed.
//
// From each category's daily order we serve a fixed-size MAIN slice; the rest is
// the BONUS pool (the questions you never saw that day). A category LOCKS OUT
// once its served slice is exhausted/earned — handled in component state, but
// the partitioning itself lives here so it can be tested.

import { CATEGORIES, CATEGORY_HEX, type Category, type Question } from "./types";
import { daySeed, dailyOrder, mulberry32, hashKey } from "./rng";

/** How many questions each category serves in the main six-wedge round. */
export const PER_CATEGORY_MAIN = 3;

export interface DailyWedges {
  /** category → its full daily-ordered list (shared across all players). */
  order: Record<Category, Question[]>;
  /** category → the main-round slice (first PER_CATEGORY_MAIN, in order). */
  served: Record<Category, Question[]>;
  /** the leftover questions never served in the main round, flattened. */
  bonus: Question[];
}

function emptyByCat<T>(make: () => T): Record<Category, T> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, make()])) as Record<
    Category,
    T
  >;
}

/**
 * Partition a pool into per-category daily order + served slice + bonus pool.
 * Deterministic for a given (pool, dayIndex): identical for every player.
 */
export function buildDailyWedges(
  pool: Question[],
  dayIndex = daySeed(),
): DailyWedges {
  const byCat = emptyByCat<Question[]>(() => []);
  for (const q of pool) {
    if (byCat[q.category]) byCat[q.category].push(q);
  }

  const order = emptyByCat<Question[]>(() => []);
  const served = emptyByCat<Question[]>(() => []);
  const bonus: Question[] = [];

  for (const cat of CATEGORIES) {
    const ordered = dailyOrder(cat, byCat[cat], dayIndex);
    order[cat] = ordered;
    served[cat] = ordered.slice(0, PER_CATEGORY_MAIN);
    bonus.push(...ordered.slice(PER_CATEGORY_MAIN));
  }

  return { order, served, bonus };
}

// ── Shattered mirror: fault lines that differ each day ──────────────────────
// Six shards (one per wedge). Each shard is a pie slice whose dividing spokes
// wobble by a date-seeded jitter, so the mirror cracks along different lines
// daily. Pure geometry — render the returned paths as SVG.

export interface MirrorShard {
  category: Category;
  /** SVG path for the shard (a jittered pie slice from the centre). */
  path: string;
  /** fill colour (category hex). */
  fill: string;
}

export function shatterMirror(
  dayIndex = daySeed(),
  cx = 60,
  cy = 60,
  r = 54,
): MirrorShard[] {
  const rand = mulberry32(0xa5a5 ^ hashKey("mirror") ^ dayIndex);
  // Six spoke angles around the circle, each nudged off the even split so the
  // fault lines drift daily. Keep them sorted/monotonic so shards never overlap.
  const base = CATEGORIES.map((_, i) => (i / 6) * 2 * Math.PI);
  const angles = base.map(
    (a, i) => a + (i === 0 ? 0 : (rand() - 0.5) * (Math.PI / 6)),
  );
  // small inner gap so cracks read as separated glass
  const gap = 0.03;

  return CATEGORIES.map((cat, i) => {
    const a0 = angles[i] - Math.PI / 2 + gap;
    const a1 = (angles[(i + 1) % 6] || 2 * Math.PI) - Math.PI / 2 - gap;
    // wrap the last shard back to the first spoke
    const end = i === 5 ? base[0] + 2 * Math.PI - Math.PI / 2 - gap : a1;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(end);
    const y1 = cy + r * Math.sin(end);
    const large = end - a0 > Math.PI ? 1 : 0;
    return {
      category: cat,
      path: `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      fill: CATEGORY_HEX[cat],
    };
  });
}

// ── The resident ghost ──────────────────────────────────────────────────────
// A Secret Order member who "didn't leave". On a miss/timeout he drifts in with
// a themed quip, picked deterministically from the question + a salt so the same
// miss always earns the same jab (comparable across players), but varies enough.

export const GHOST_NAME = "Hollis, the Lingering Member";

export const GHOST_QUIPS: string[] = [
  "Cold. Like my tea. Like your guess.",
  "I've haunted this parlor for ninety years and even I knew that one.",
  "Tick, tick... and then nothing. A pity.",
  "The candle flickered. So did your nerve.",
  "Closer than the last poor soul. Not close enough.",
  "I'd applaud, but my hands pass through each other.",
  "The mirror saw it coming. You did not.",
  "Don't fret — eternity gives one ample time to improve.",
];

/** Pick a quip deterministically for a given miss (question + attempt index). */
export function ghostQuip(salt: string, n = GHOST_QUIPS.length): string {
  return GHOST_QUIPS[hashKey(salt) % n];
}
