import { describe, expect, it } from "vitest";
import { buildPuzzle } from "./clockLogic";
import {
  CALENDARS,
  labelFor,
  pickCalendar,
  frenchRepublicanYear,
  holoceneYear,
  mayanLongCount,
  centuryLabel,
} from "./calendars";

describe("buildPuzzle (logic layer)", () => {
  it("always produces a window that contains the target", () => {
    const ceiling = new Date().getFullYear();
    for (let y = 1800; y <= ceiling; y++) {
      const p = buildPuzzle(y, ceiling, y * 7 + 13);
      expect(p.min).toBeLessThanOrEqual(y);
      expect(p.max).toBeGreaterThanOrEqual(y);
    }
  });

  it("constrains the range (window is narrower than the full span)", () => {
    const ceiling = 2026;
    const p = buildPuzzle(1969, ceiling, 42);
    expect(p.max - p.min).toBeLessThan(ceiling - 1800);
    expect(p.clues.length).toBeGreaterThanOrEqual(2);
    expect(p.clues.length).toBeLessThanOrEqual(4);
  });

  it("is deterministic for the same seed", () => {
    const a = buildPuzzle(1888, 2026, 99);
    const b = buildPuzzle(1888, 2026, 99);
    expect(a).toEqual(b);
  });
});

describe("calendar conversions (pure, deterministic)", () => {
  it("Gregorian is identity", () => {
    expect(CALENDARS[0].key).toBe("gregorian");
    expect(labelFor("gregorian", 1969)).toBe("1969");
  });

  it("French Republican counts from An I = 1792", () => {
    expect(frenchRepublicanYear(1792)).toBe("An I");
    expect(frenchRepublicanYear(1793)).toBe("An II");
  });

  it("Holocene adds ten millennia", () => {
    expect(holoceneYear(2026)).toBe("12026 HE");
  });

  it("century label is ordinal of the century", () => {
    expect(centuryLabel(1969)).toBe("20th century");
    expect(centuryLabel(2001)).toBe("21st century");
  });

  it("Mayan long count is stable baktun.katun.tun", () => {
    // 2012 sat near the 13.0.0 rollover under the GMT correlation.
    expect(mayanLongCount(2012)).toBe("12.19.19");
  });

  it("pickCalendar is deterministic per day", () => {
    expect(pickCalendar(20000)).toEqual(pickCalendar(20000));
  });
});
