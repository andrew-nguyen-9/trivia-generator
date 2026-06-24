import { describe, expect, it } from "vitest";
import {
  FLAME_MIN,
  FLAME_MAX,
  SECONDS_START,
  SECONDS_FLOOR,
  flameBrightness,
  answerSeconds,
  buildStreakDeck,
} from "./streak";
import type { Question } from "./types";

const q = (category: Question["category"], i: number): Question => ({
  qtype: "higher_lower",
  category,
  difficulty: 3,
  prompt: `${category} ${i}`,
  correct: "higher",
  value_a: 1,
  value_b: 2,
  subject_a: "a",
  subject_b: "b",
  unit: "things",
});

describe("flameBrightness", () => {
  it("is monotonically non-decreasing in streak", () => {
    for (let s = 0; s < 60; s++) {
      expect(flameBrightness(s + 1)).toBeGreaterThanOrEqual(flameBrightness(s));
    }
  });

  it("stays within [FLAME_MIN, FLAME_MAX]", () => {
    for (let s = 0; s <= 500; s++) {
      const b = flameBrightness(s);
      expect(b).toBeGreaterThanOrEqual(FLAME_MIN);
      expect(b).toBeLessThanOrEqual(FLAME_MAX);
    }
  });

  it("starts dim and brightens with the first correct calls", () => {
    expect(flameBrightness(0)).toBeCloseTo(FLAME_MIN, 6);
    expect(flameBrightness(5)).toBeGreaterThan(flameBrightness(0));
  });
});

describe("answerSeconds (accelerating timer)", () => {
  it("is monotonically non-increasing in streak (it accelerates)", () => {
    for (let s = 0; s < 60; s++) {
      expect(answerSeconds(s + 1)).toBeLessThanOrEqual(answerSeconds(s));
    }
  });

  it("starts at SECONDS_START and never drops below the floor", () => {
    expect(answerSeconds(0)).toBeCloseTo(SECONDS_START, 6);
    for (let s = 0; s <= 500; s++) {
      expect(answerSeconds(s)).toBeGreaterThanOrEqual(SECONDS_FLOOR);
      expect(answerSeconds(s)).toBeLessThanOrEqual(SECONDS_START);
    }
  });
});

describe("buildStreakDeck", () => {
  const pool = [
    ...Array.from({ length: 4 }, (_, i) => q("history", i)),
    ...Array.from({ length: 4 }, (_, i) => q("music", i)),
    ...Array.from({ length: 4 }, (_, i) => q("sports", i)),
  ];

  it("preserves every question exactly once", () => {
    const deck = buildStreakDeck(pool, 7);
    expect(deck).toHaveLength(pool.length);
    expect(new Set(deck.map((d) => d.prompt)).size).toBe(pool.length);
  });

  it("interleaves categories so early pairs span more categories than a flat list", () => {
    const deck = buildStreakDeck(pool, 7);
    // first 3 questions should hit 3 distinct categories (round-robin)
    expect(new Set(deck.slice(0, 3).map((d) => d.category)).size).toBe(3);
  });

  it("is deterministic for a given dayIndex", () => {
    expect(buildStreakDeck(pool, 7)).toEqual(buildStreakDeck(pool, 7));
  });

  it("handles an empty pool", () => {
    expect(buildStreakDeck([], 1)).toEqual([]);
  });
});
