import { describe, it, expect } from "vitest";
import {
  buildShare,
  emojiGrid,
  encodeTiers,
  decodeTiers,
  ogImageUrl,
  type GameResult,
} from "./share";

// This file doubles as the §3.0 END-STATE proof: a sample consumer importing
// lib/share.ts and producing a share artifact WITHOUT touching any shared file.

const run: GameResult = {
  room: "/gauntlet",
  date: "2026-06-26",
  tiers: ["hit", "near", "miss", "blank", "hit"],
  score: 3,
  maxScore: 5,
  columns: 0,
};

describe("emojiGrid", () => {
  it("maps tiers to squares on one line when unwrapped", () => {
    expect(emojiGrid(run.tiers)).toBe("🟩🟨⬛⬜🟩");
  });

  it("wraps into rows of `columns`", () => {
    expect(emojiGrid(["hit", "hit", "miss", "miss"], 2)).toBe("🟩🟩\n⬛⬛");
  });
});

describe("tier codec", () => {
  it("round-trips through the compact code", () => {
    expect(decodeTiers(encodeTiers(run.tiers))).toEqual(run.tiers);
  });

  it("decodes unknown chars as blank (forgiving)", () => {
    expect(decodeTiers("hxq")).toEqual(["hit", "blank", "blank"]);
  });
});

describe("ogImageUrl", () => {
  it("encodes grid + date + score into the OG endpoint URL", () => {
    const url = new URL(ogImageUrl(run, "https://example.test"));
    expect(url.pathname).toBe("/api/og/gauntlet");
    expect(url.searchParams.get("g")).toBe("hnmbh");
    expect(url.searchParams.get("d")).toBe("2026-06-26");
    expect(url.searchParams.get("s")).toBe("3");
    expect(url.searchParams.get("m")).toBe("5");
  });
});

describe("buildShare", () => {
  it("produces a Wordle-style blob with title, score, grid, and link", () => {
    const card = buildShare(run, "https://example.test");
    expect(card.title).toBe("PARLOR · The Gauntlet");
    expect(card.grid).toBe("🟩🟨⬛⬜🟩");
    expect(card.url).toBe("https://example.test/gauntlet");
    expect(card.text).toContain("3/5 · 2026-06-26");
    expect(card.text).toContain("🟩🟨⬛⬜🟩");
  });
});
