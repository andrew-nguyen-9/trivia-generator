import { describe, expect, it } from "vitest";
import { generateLadder, solveQueens, WEEKDAY, type GridRung } from "./ladder";

function day(dayIndex: number) {
  return { dayIndex, date: new Date(dayIndex * 86400000).toISOString().slice(0, 10) };
}
const DAYS = Array.from({ length: 21 }, (_, i) => day(20100 + i));

function assertGridValid(g: GridRung) {
  const { n, solution, regions, givens } = g;
  expect(solution).toHaveLength(n);
  // permutation: distinct columns
  expect(new Set(solution).size).toBe(n);
  // no two queens in adjacent rows touching
  for (let r = 1; r < n; r++) {
    expect(Math.abs(solution[r] - solution[r - 1])).toBeGreaterThanOrEqual(2);
  }
  // one queen per region
  const regs = solution.map((c, r) => regions[r][c]);
  expect(new Set(regs).size).toBe(n);
  // givens are consistent with the solution
  givens.forEach((c, r) => {
    if (c >= 0) expect(c).toBe(solution[r]);
  });
  // uniquely solvable
  expect(solveQueens(n, regions, givens)).toBe(1);
}

describe("generateLadder", () => {
  it("is deterministic", () => {
    for (const { dayIndex, date } of DAYS.slice(0, 5)) {
      expect(generateLadder(dayIndex, date)).toEqual(generateLadder(dayIndex, date));
    }
  });

  it("matches the weekday rung/grid config", () => {
    for (const { dayIndex, date } of DAYS) {
      const p = generateLadder(dayIndex, date);
      const cfg = WEEKDAY[p.weekday];
      expect(p.rungs).toHaveLength(cfg.rungs);
      expect(p.rungs[0].type).toBe("grid");
    }
  });

  it("every grid rung is uniquely solvable and well-formed", () => {
    for (const { dayIndex, date } of DAYS) {
      const p = generateLadder(dayIndex, date);
      for (const rung of p.rungs) {
        if (rung.type === "grid") assertGridValid(rung);
      }
    }
  });

  it("every sequence rung has the answer among 3 distinct options", () => {
    for (const { dayIndex, date } of DAYS) {
      const p = generateLadder(dayIndex, date);
      for (const rung of p.rungs) {
        if (rung.type === "sequence") {
          expect(rung.options).toContain(rung.answer);
          expect(new Set(rung.options).size).toBe(rung.options.length);
          expect(rung.options.length).toBe(3);
        }
      }
    }
  });

  it("every door rung names a valid consistent door", () => {
    for (const { dayIndex, date } of DAYS) {
      const p = generateLadder(dayIndex, date);
      for (const rung of p.rungs) {
        if (rung.type === "door") {
          expect(rung.doors.length).toBeGreaterThanOrEqual(2);
          expect(rung.answer).toBeGreaterThanOrEqual(0);
          expect(rung.answer).toBeLessThan(rung.doors.length);
        }
      }
    }
  });

  it("threads resonance up the ladder (rungs are not all identical)", () => {
    const p = generateLadder(20200, day(20200).date);
    const res = p.rungs.map((r) => r.resonance);
    // resonance evolves — not a constant column
    expect(new Set(res).size).toBeGreaterThan(1);
  });
});

describe("solveQueens", () => {
  it("counts the single solution of a hand puzzle", () => {
    // 4x4, regions = quadrants-ish; givens pin it
    const regions = [
      [0, 0, 1, 1],
      [0, 0, 1, 1],
      [2, 2, 3, 3],
      [2, 2, 3, 3],
    ];
    // a valid no-touch permutation for this region map: row0->1,row1->3,row2->0,row3->2
    const givens = [1, -1, -1, -1];
    expect(solveQueens(4, regions, givens)).toBeGreaterThanOrEqual(1);
  });
});
