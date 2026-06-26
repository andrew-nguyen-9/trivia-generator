// Weak-spot practice (§3.19). Reads the per-category accuracy the profile already
// aggregates in localStorage (see lib/profile.ts `cat`) and points the player at the
// room where they can drill their worst category. Pure — no React, no storage writes.

import { CATEGORIES, CATEGORY_LABEL, type Category } from "./types";

export type CatStats = Partial<Record<Category, { correct: number; total: number }>>;

// One room to practice each category in. Suit = accent, mirrors app/page.tsx's deck.
const PRACTICE_ROOM: Record<Category, { href: string; room: string }> = {
  history: { href: "/board", room: "Codex" },
  music: { href: "/clock", room: "Chronos" },
  sports: { href: "/wedges", room: "Fractures" },
  screen: { href: "/streak", room: "Ignite" },
  geography: { href: "/map", room: "Atlas Obscura" },
  wildcard: { href: "/gauntlet", room: "The Gauntlet" },
};

// ponytail: below this, accuracy is too noisy to call a weak spot. Bump if 5 answers
// still surfaces flukey categories.
const MIN_SAMPLE = 5;

export interface WeakSpot {
  category: Category;
  label: string;
  accuracy: number; // 0..1
  href: string;
  room: string;
}

/** Weakest category by accuracy among those with enough answered questions.
 *  Returns null until the player has a meaningfully-sampled category to drill. */
export function weakestCategory(cat: CatStats): WeakSpot | null {
  let worst: { category: Category; accuracy: number } | null = null;
  for (const c of CATEGORIES) {
    const s = cat[c];
    if (!s || s.total < MIN_SAMPLE) continue;
    const accuracy = s.correct / s.total;
    if (!worst || accuracy < worst.accuracy) worst = { category: c, accuracy };
  }
  if (!worst) return null;
  return {
    category: worst.category,
    label: CATEGORY_LABEL[worst.category],
    accuracy: worst.accuracy,
    ...PRACTICE_ROOM[worst.category],
  };
}
