import { describe, expect, it } from "vitest";
import {
  CIVILIZATIONS,
  pickCivilization,
  civRounds,
} from "./civilizations";

describe("daily civilization (pure, deterministic)", () => {
  it("is stable for the same day", () => {
    expect(pickCivilization(20000)).toBe(pickCivilization(20000));
  });

  it("always returns a civilization from the array", () => {
    for (let d = 0; d < 200; d++) {
      expect(CIVILIZATIONS).toContain(pickCivilization(d));
    }
  });

  it("rotates across days (not stuck on one civ)", () => {
    const seen = new Set<string>();
    for (let d = 0; d < 200; d++) seen.add(pickCivilization(d).key);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("every civ's themed choices include the correct answer", () => {
    for (const civ of CIVILIZATIONS) {
      for (const q of civ.questions) {
        expect(q.choices).toContain(q.correct);
      }
    }
  });

  it("civRounds leads with a place-this-civ `where` round at the civ's site", () => {
    const civ = pickCivilization(20000);
    const rounds = civRounds(civ);
    expect(rounds[0].qtype).toBe("where");
    expect(rounds[0].lat).toBe(civ.site.lat);
    expect(rounds[0].lng).toBe(civ.site.lng);
    expect(rounds.slice(1).every((r) => r.qtype === "multiple_choice")).toBe(true);
  });
});
