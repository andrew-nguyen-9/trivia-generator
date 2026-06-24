// THE STREAK — pure render-time helpers for the Witch's candle.
//
// Two monotonic curves drive the room and nothing here touches the DOM, a
// clock, or Math.random, so they're trivially testable and SSR-safe:
//   • flameBrightness(streak) — the candle's bloom grows with each correct call
//   • answerSeconds(streak)   — the per-answer countdown shrinks as you climb
// Plus a deterministic, category-balanced deck order so a run visits MORE
// categories than v1 (which just Math.random-shuffled one flat pool).

import { dailyOrder } from "./rng";
import type { Category, Question } from "./types";

// Flame brightness in [FLAME_MIN, FLAME_MAX]. A bounded, saturating curve: each
// correct answer brightens the flame, with diminishing returns so it blooms
// fast early then eases toward a ceiling (never blinding the Q&A behind it).
export const FLAME_MIN = 0.18;
export const FLAME_MAX = 1;

export function flameBrightness(streak: number): number {
  const s = Math.max(0, streak);
  // 1 - e^(-s/6): 0 at s=0, ~0.63 by s=6, asymptotes to 1.
  const t = 1 - Math.exp(-s / 6);
  return FLAME_MIN + (FLAME_MAX - FLAME_MIN) * t;
}

// Per-answer countdown, in seconds. Starts generous, accelerates (shrinks)
// toward a hard floor so the run stays winnable but tightens relentlessly.
export const SECONDS_START = 12;
export const SECONDS_FLOOR = 3.5;
const DECAY_PER_STREAK = 0.86; // 14% faster each correct call

export function answerSeconds(streak: number): number {
  const s = Math.max(0, streak);
  const eased = SECONDS_START * Math.pow(DECAY_PER_STREAK, s);
  return Math.max(SECONDS_FLOOR, eased);
}

// A deterministic deck that interleaves categories round-robin so consecutive
// pairs hop across the bank (more category coverage than a flat shuffle). The
// per-category order is the shared daily order (lib/rng), so the run is stable
// for a given day and SSR/client agree until the player reshuffles.
export function buildStreakDeck(pool: Question[], dayIndex?: number): Question[] {
  if (pool.length === 0) return [];
  const byCat = new Map<Category, Question[]>();
  for (const q of pool) {
    byCat.set(q.category, [...(byCat.get(q.category) ?? []), q]);
  }
  // Order each category's questions deterministically, then drain round-robin.
  const lanes = [...byCat.entries()].map(([cat, qs]) => dailyOrder(cat, qs, dayIndex));
  const out: Question[] = [];
  for (let i = 0; out.length < pool.length; i++) {
    for (const lane of lanes) {
      if (i < lane.length) out.push(lane[i]);
    }
  }
  return out;
}
