import { describe, expect, it } from "vitest";
import {
  buildWeeklyCase,
  survivors,
  weeklyBucket,
  satisfies,
  DIMS,
} from "./weeklyCase";

describe("weeklyCase", () => {
  const seeds = Array.from({ length: 500 }, (_, i) => i);

  it("always produces exactly 7 day-ordered clues", () => {
    for (const seed of seeds) {
      const c = buildWeeklyCase(seed);
      expect(c.clues).toHaveLength(7);
      expect(c.clues.map((cl) => cl.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    }
  });

  it("every clue is TRUE of the real culprit (clues never lie)", () => {
    for (const seed of seeds) {
      const c = buildWeeklyCase(seed);
      const guilty = c.suspects[c.culprit];
      for (const clue of c.clues) {
        expect(satisfies(guilty, clue)).toBe(true);
      }
    }
  });

  it("is solvable: by day 5 exactly one suspect survives, and it's the culprit", () => {
    for (const seed of seeds) {
      const c = buildWeeklyCase(seed);
      const byDay5 = survivors(c, 5);
      expect(byDay5).toEqual([c.culprit]);
      // and the full week stays consistent (corroboration can't break it)
      expect(survivors(c, 7)).toEqual([c.culprit]);
    }
  });

  it("narrows monotonically and is never unsolvable early (no empty/contradictory field)", () => {
    for (const seed of seeds) {
      const c = buildWeeklyCase(seed);
      let prev = c.suspects.length + 1;
      for (let day = 1; day <= 7; day++) {
        const s = survivors(c, day);
        expect(s.length).toBeGreaterThanOrEqual(1); // culprit always survives
        expect(s).toContain(c.culprit);
        expect(s.length).toBeLessThanOrEqual(prev); // never widens
        prev = s.length;
      }
    }
  });

  it("gives each suspect a unique value in every dimension", () => {
    for (const seed of [0, 1, 7, 42, 123]) {
      const c = buildWeeklyCase(seed);
      for (const dim of DIMS) {
        const vals = c.suspects.map((s) => s.attrs[dim]);
        expect(new Set(vals).size).toBe(c.suspects.length);
      }
    }
  });

  it("is deterministic in the week seed", () => {
    for (const seed of [0, 3, 99, 250]) {
      expect(buildWeeklyCase(seed)).toEqual(buildWeeklyCase(seed));
    }
  });

  it("weeklyBucket: stable week, day 0..6 within it", () => {
    expect(weeklyBucket(0)).toEqual({ weekSeed: 0, dayIndex: 0 });
    expect(weeklyBucket(6)).toEqual({ weekSeed: 0, dayIndex: 6 });
    expect(weeklyBucket(7)).toEqual({ weekSeed: 1, dayIndex: 0 });
    expect(weeklyBucket(13)).toEqual({ weekSeed: 1, dayIndex: 6 });
    // negative day-seeds (defensive) still land in range
    expect(weeklyBucket(-1).dayIndex).toBe(6);
  });
});
