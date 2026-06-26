import { describe, expect, it } from "vitest";
import { MOTIFS, feedByMotif, motifOfDay, onMotif } from "./dailyMotif";
import { themeByKey } from "./themes";

describe("motifOfDay", () => {
  it("is deterministic per day and stays in range", () => {
    for (let d = 0; d < 500; d++) {
      const a = motifOfDay(d);
      expect(motifOfDay(d)).toBe(a); // same day ⇒ same motif (SSR/client agree)
      expect(MOTIFS).toContain(a);
    }
  });

  it("rotates across days (not pinned to one motif)", () => {
    const seen = new Set(Array.from({ length: 60 }, (_, d) => motifOfDay(d).key));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("board sync", () => {
  it("every motif names a real board skin", () => {
    for (const m of MOTIFS) expect(themeByKey(m.boardThemeKey)).toBeDefined();
  });
});

describe("onMotif", () => {
  const music = MOTIFS.find((m) => m.key === "music-night")!;
  const era = MOTIFS.find((m) => m.key === "moonshot-69")!;

  it("matches on category lean", () => {
    expect(onMotif({ category: "music" }, music)).toBe(true);
    expect(onMotif({ category: "sports" }, music)).toBe(false);
  });

  it("matches on year window for era motifs", () => {
    expect(onMotif({ year: 1969 }, era)).toBe(true);
    expect(onMotif({ year: 1999 }, era)).toBe(false);
    expect(onMotif({ year: null }, era)).toBe(false);
  });

  it("matches on text needles, case-insensitively", () => {
    expect(onMotif({ text: "Name this ALBUM cover" }, music)).toBe(true);
    expect(onMotif({ text: "unrelated prompt" }, music)).toBe(false);
  });
});

describe("feedByMotif", () => {
  it("floats on-motif items to the front, stable otherwise", () => {
    const music = MOTIFS.find((m) => m.key === "music-night")!;
    const pool = [
      { id: "a", category: "sports" as const },
      { id: "b", category: "music" as const },
      { id: "c", category: "history" as const },
      { id: "d", category: "music" as const },
    ];
    const out = feedByMotif(pool, music, (q) => ({ category: q.category }));
    expect(out.map((q) => q.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("returns every item exactly once", () => {
    const m = motifOfDay(7);
    const pool = Array.from({ length: 20 }, (_, i) => ({ i }));
    const out = feedByMotif(pool, m, () => ({}));
    expect(out).toHaveLength(pool.length);
    expect(new Set(out)).toEqual(new Set(pool));
  });
});
