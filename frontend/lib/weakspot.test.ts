import { describe, expect, it } from "vitest";
import { weakestCategory } from "./weakspot";

describe("weakestCategory", () => {
  it("returns null with no data", () => {
    expect(weakestCategory({})).toBeNull();
  });

  it("ignores categories below the min sample", () => {
    // history 0/4 looks awful but is too small to count; music 6/10 wins by default.
    expect(weakestCategory({ history: { correct: 0, total: 4 }, music: { correct: 6, total: 10 } })?.category).toBe("music");
  });

  it("picks the lowest accuracy among well-sampled categories", () => {
    const w = weakestCategory({
      history: { correct: 9, total: 10 }, // 90%
      sports: { correct: 2, total: 10 }, // 20% ← worst
      music: { correct: 5, total: 10 }, // 50%
    });
    expect(w?.category).toBe("sports");
    expect(w?.href).toBe("/wedges");
    expect(w?.accuracy).toBeCloseTo(0.2);
  });
});
