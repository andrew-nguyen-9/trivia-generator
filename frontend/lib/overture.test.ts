import { describe, expect, it } from "vitest";
// relative import: vitest does not resolve the @/ alias used in app code.
import { titleFromSource, titledRows, buildChoices } from "./overture";
import { mulberry32 } from "./rng";
import type { Question } from "./types";

const q = (source_url: string | null): Question => ({
  qtype: "audio_guess",
  category: "music",
  difficulty: 1,
  prompt: "x",
  correct: "1824",
  source_url,
});

describe("titleFromSource", () => {
  it("decodes a wiki slug into a title", () => {
    expect(titleFromSource("https://en.wikipedia.org/wiki/Ode_to_Joy")).toBe("Ode to Joy");
    expect(titleFromSource("https://en.wikipedia.org/wiki/Jingle_Bells")).toBe("Jingle Bells");
  });
  it("handles apostrophes and percent-escapes", () => {
    expect(titleFromSource("https://en.wikipedia.org/wiki/Beethoven's_Fifth_Symphony")).toBe(
      "Beethoven's Fifth Symphony",
    );
    expect(titleFromSource("https://en.wikipedia.org/wiki/F%C3%BCr_Elise")).toBe("Für Elise");
  });
  it("returns null when no title is derivable", () => {
    expect(titleFromSource(null)).toBeNull();
    expect(titleFromSource("")).toBeNull();
    expect(titleFromSource("https://www.deezer.com/track/12345")).toBeNull();
    expect(titleFromSource("https://en.wikipedia.org/wiki/")).toBeNull();
  });
});

describe("titledRows", () => {
  it("keeps only rows with a derivable title", () => {
    const rows = titledRows([
      q("https://en.wikipedia.org/wiki/Ode_to_Joy"),
      q("https://www.deezer.com/track/1"),
      q(null),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Ode to Joy");
  });
});

describe("buildChoices", () => {
  const rand = mulberry32(42);
  it("always includes the correct title", () => {
    const c = buildChoices("Ode to Joy", ["Jingle Bells", "Für Elise", "Happy Birthday"], rand);
    expect(c).toContain("Ode to Joy");
  });
  it("never duplicates a choice and respects the cap", () => {
    const c = buildChoices("A", ["B", "B", "C", "D", "E", "F"], rand, 4);
    expect(c).toHaveLength(4);
    expect(new Set(c).size).toBe(c.length);
  });
  it("degrades gracefully with a tiny pool", () => {
    const c = buildChoices("A", ["B"], rand, 4);
    expect(c).toHaveLength(2);
    expect(c).toContain("A");
    expect(c).toContain("B");
  });
  it("never leaks the correct title in as a distractor", () => {
    const c = buildChoices("A", ["A", "A", "B"], rand, 4);
    expect(c.filter((x) => x === "A")).toHaveLength(1);
  });
});
