import { describe, expect, it } from "vitest";
import { generateSeance, solutionCount, WEEKDAY, type Clue, type SeancePuzzle } from "./seance";

// (dayIndex, YYYY-MM-DD) pairs — date derived from the epoch-day so the weekday
// the engine reads always matches dayIndex.
function day(dayIndex: number): { dayIndex: number; date: string } {
  return { dayIndex, date: new Date(dayIndex * 86400000).toISOString().slice(0, 10) };
}

// seat of each (cat,val) from the solution matrix
function posOf(p: SeancePuzzle): number[][] {
  return p.solution.map((seatToVal) => {
    const arr = Array(p.n).fill(-1);
    seatToVal.forEach((v, s) => (arr[v] = s));
    return arr;
  });
}

function clueHolds(c: Clue, pos: number[][]): boolean {
  const a = pos[c.a.cat][c.a.val];
  const b = c.b ? pos[c.b.cat][c.b.val] : -1;
  switch (c.type) {
    case "at": return a === c.seat;
    case "same": return a === b;
    case "diff": return a !== b;
    case "order": return a < b;
    case "neighbor": return Math.abs(a - b) === 1;
  }
}

// A representative span of days (covers all 7 weekdays several times over).
const DAYS = Array.from({ length: 21 }, (_, i) => day(20000 + i));

describe("generateSeance", () => {
  it("is deterministic", () => {
    for (const { dayIndex, date } of DAYS.slice(0, 5)) {
      expect(generateSeance(dayIndex, date)).toEqual(generateSeance(dayIndex, date));
    }
  });

  it("produces exactly one solution every day", () => {
    for (const { dayIndex, date } of DAYS) {
      const p = generateSeance(dayIndex, date);
      expect(solutionCount(p.clues, p.n, p.categories.length)).toBe(1);
    }
  });

  it("the stored solution satisfies every clue", () => {
    for (const { dayIndex, date } of DAYS) {
      const p = generateSeance(dayIndex, date);
      const pos = posOf(p);
      for (const c of p.clues) expect(clueHolds(c, pos)).toBe(true);
    }
  });

  it("the clue set is minimal (removing any clue breaks uniqueness)", () => {
    for (const { dayIndex, date } of DAYS.slice(0, 6)) {
      const p = generateSeance(dayIndex, date);
      for (let i = 0; i < p.clues.length; i++) {
        const trimmed = p.clues.filter((_, j) => j !== i);
        expect(solutionCount(trimmed, p.n, p.categories.length)).toBeGreaterThan(1);
      }
    }
  });

  it("matches the weekday config for grid size and category count", () => {
    for (const { dayIndex, date } of DAYS) {
      const p = generateSeance(dayIndex, date);
      const cfg = WEEKDAY[p.weekday];
      expect(p.n).toBe(cfg.n);
      expect(p.categories).toHaveLength(cfg.cats);
      expect(p.whisper).toBe(cfg.whisper);
      for (const cat of p.categories) expect(cat.values).toHaveLength(p.n);
    }
  });
});
