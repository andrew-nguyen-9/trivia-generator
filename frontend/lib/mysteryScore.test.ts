import { describe, expect, it } from "vitest";
import { generateCase } from "./mystery";
import { score, shareText, type MysteryAttempt } from "./mysteryScore";

describe("score", () => {
  it("awards full base score with one clue, no time, and a perfect table", () => {
    const c = generateCase("2026-06-16");
    const tableTags: MysteryAttempt["tableTags"] = {};
    for (const s of c.suspects) {
      tableTags[s.id] = c.culprits.includes(s.id) ? "prime" : "cleared";
    }
    const attempt: MysteryAttempt = {
      whoGuess: c.culprits,
      whereGuess: c.scene,
      whenGuess: c.hourIndex,
      cluesRevealed: 1,
      elapsedSeconds: 0,
      tableTags,
      autoMarkUsed: false,
    };
    const result = score(c, attempt);
    expect(result.won).toBe(true);
    expect(result.breakdown.cluePenalty).toBe(0);
    expect(result.breakdown.timePenalty).toBe(0);
    expect(result.breakdown.tableBonus).toBe(40 * c.suspects.length);
    expect(result.total).toBe(1000 + 40 * c.suspects.length);
  });

  it("penalizes extra clue reveals and elapsed time", () => {
    const c = generateCase("2026-06-16");
    const attempt: MysteryAttempt = {
      whoGuess: c.culprits,
      whereGuess: c.scene,
      whenGuess: c.hourIndex,
      cluesRevealed: 4,
      elapsedSeconds: 100,
      tableTags: {},
      autoMarkUsed: false,
    };
    const result = score(c, attempt);
    expect(result.breakdown.cluePenalty).toBe(80 * 3);
    expect(result.breakdown.timePenalty).toBe(20);
    expect(result.breakdown.tableBonus).toBe(0);
    expect(result.total).toBe(1000 - 240 - 20);
  });

  it("never lets penalties push the score below zero before the table bonus", () => {
    const c = generateCase("2026-06-16");
    const attempt: MysteryAttempt = {
      whoGuess: [],
      whereGuess: null,
      whenGuess: null,
      cluesRevealed: 7,
      elapsedSeconds: 100_000,
      tableTags: {},
      autoMarkUsed: false,
    };
    const result = score(c, attempt);
    expect(result.total).toBe(0);
    expect(result.won).toBe(false);
  });

  it("requires WHO+WHERE+WHEN all correct to win", () => {
    const c = generateCase("2026-06-16");
    const attempt: MysteryAttempt = {
      whoGuess: c.culprits,
      whereGuess: "nowhere",
      whenGuess: c.hourIndex,
      cluesRevealed: 1,
      elapsedSeconds: 0,
      tableTags: {},
      autoMarkUsed: false,
    };
    expect(score(c, attempt).won).toBe(false);
  });
});

describe("shareText", () => {
  it("includes the case number, score, time, and one square per clue", () => {
    const c = generateCase("2026-06-16");
    const attempt: MysteryAttempt = {
      whoGuess: c.culprits,
      whereGuess: c.scene,
      whenGuess: c.hourIndex,
      cluesRevealed: 3,
      elapsedSeconds: 65,
      tableTags: {},
      autoMarkUsed: false,
    };
    const result = score(c, attempt);
    const text = shareText(c, attempt, result);
    expect(text).toContain(`CASE #${c.caseNumber}`);
    expect(text).toContain("CASE CLOSED");
    expect(text).toContain(`Score: ${result.total}`);
    expect(text).toContain("Time: 1:05");

    const squareLine = text.split("\n")[2];
    const squares = Array.from(squareLine);
    expect(squares.length).toBe(c.clues.length);
    expect(squares.filter((s) => s === "🟨").length).toBe(attempt.cluesRevealed);
    expect(squares.filter((s) => s === "🟩").length).toBe(c.clues.length - attempt.cluesRevealed);
  });

  it("shows COLD CASE when the attempt didn't win", () => {
    const c = generateCase("2026-06-16");
    const attempt: MysteryAttempt = {
      whoGuess: [],
      whereGuess: null,
      whenGuess: null,
      cluesRevealed: 7,
      elapsedSeconds: 30,
      tableTags: {},
      autoMarkUsed: false,
    };
    const result = score(c, attempt);
    const text = shareText(c, attempt, result);
    expect(text).toContain("COLD CASE");
  });
});
