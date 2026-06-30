import { describe, expect, it } from "vitest";
import { getSeancePuzzle, getLadderPuzzle } from "./queries";
import { generateSeance } from "./seance";
import { generateLadder } from "./ladder";

// Root-cause regression: with zero env vars (no DATABASE_URL in this test
// run) both rooms used to return null and the UI showed the "summoned
// nightly" placeholder forever. They must now generate a real puzzle inline.
describe("offline fallback (no DB)", () => {
  it("getSeancePuzzle generates the same puzzle generateSeance would for that date", async () => {
    const date = "2026-06-30";
    const puzzle = await getSeancePuzzle(date);
    expect(puzzle).not.toBeNull();
    const dayIndex = Math.floor(Date.parse(date + "T00:00:00Z") / 86_400_000);
    expect(puzzle).toEqual(generateSeance(dayIndex, date));
  });

  it("getLadderPuzzle generates the same puzzle generateLadder would for that date", async () => {
    const date = "2026-06-30";
    const puzzle = await getLadderPuzzle(date);
    expect(puzzle).not.toBeNull();
    const dayIndex = Math.floor(Date.parse(date + "T00:00:00Z") / 86_400_000);
    expect(puzzle).toEqual(generateLadder(dayIndex, date));
  });

  it("both rooms also render with no date arg (today)", async () => {
    expect(await getSeancePuzzle()).not.toBeNull();
    expect(await getLadderPuzzle()).not.toBeNull();
  });
});
