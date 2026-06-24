import { describe, expect, it } from "vitest";
import { dailyOrder } from "./rng";
import {
  buildDailyWedges,
  shatterMirror,
  ghostQuip,
  PER_CATEGORY_MAIN,
  GHOST_QUIPS,
} from "./wedges";
import { CATEGORIES, type Question } from "./types";

function q(category: string, prompt: string): Question {
  return {
    qtype: "multiple_choice",
    category: category as Question["category"],
    difficulty: 1,
    prompt,
    correct: "a",
    choices: ["a", "b", "c", "d"],
  };
}

// A pool with plenty of volume per category.
function pool(): Question[] {
  const out: Question[] = [];
  for (const c of CATEGORIES) {
    for (let i = 0; i < 10; i++) out.push(q(c, `${c}-${i}`));
  }
  return out;
}

describe("dailyOrder (shared daily order)", () => {
  it("is identical for two players on the same date", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    const p1 = dailyOrder("history", items, 20000);
    const p2 = dailyOrder("history", items, 20000);
    expect(p1).toEqual(p2);
  });

  it("returns a permutation (every question exactly once, no drops/dupes)", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    const ordered = dailyOrder("music", items, 20000);
    expect([...ordered].sort()).toEqual([...items].sort());
  });

  it("rotates day-to-day but keys diverge per category", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    expect(dailyOrder("history", items, 20000)).not.toEqual(
      dailyOrder("history", items, 20001),
    );
    expect(dailyOrder("history", items, 20000)).not.toEqual(
      dailyOrder("music", items, 20000),
    );
  });

  it("is empty-safe", () => {
    expect(dailyOrder("history", [], 20000)).toEqual([]);
  });
});

describe("buildDailyWedges (lockout + bonus partitioning)", () => {
  it("is deterministic for a fixed (pool, day)", () => {
    const a = buildDailyWedges(pool(), 20000);
    const b = buildDailyWedges(pool(), 20000);
    expect(a).toEqual(b);
  });

  it("serves exactly PER_CATEGORY_MAIN per category, in daily order", () => {
    const w = buildDailyWedges(pool(), 20000);
    for (const c of CATEGORIES) {
      expect(w.served[c]).toHaveLength(PER_CATEGORY_MAIN);
      expect(w.served[c]).toEqual(w.order[c].slice(0, PER_CATEGORY_MAIN));
    }
  });

  it("bonus is exactly the never-served remainder (no overlap, no loss)", () => {
    const w = buildDailyWedges(pool(), 20000);
    const servedSet = new Set<string>();
    for (const c of CATEGORIES) for (const s of w.served[c]) servedSet.add(s.prompt);
    for (const b of w.bonus) expect(servedSet.has(b.prompt)).toBe(false);
    const total = Object.values(w.order).reduce((n, arr) => n + arr.length, 0);
    expect(servedSet.size + w.bonus.length).toBe(total);
  });
});

describe("shatterMirror", () => {
  it("is deterministic per day and yields six category shards", () => {
    const a = shatterMirror(20000);
    const b = shatterMirror(20000);
    expect(a).toEqual(b);
    expect(a.map((s) => s.category)).toEqual(CATEGORIES);
  });

  it("cracks along different fault lines on different days", () => {
    expect(shatterMirror(20000)).not.toEqual(shatterMirror(20001));
  });
});

describe("ghostQuip", () => {
  it("is deterministic for the same salt and stays in range", () => {
    expect(ghostQuip("miss-x")).toBe(ghostQuip("miss-x"));
    expect(GHOST_QUIPS).toContain(ghostQuip("anything"));
  });
});
