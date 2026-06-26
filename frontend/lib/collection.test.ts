import { describe, expect, it } from "vitest";
import {
  COLLECTION,
  collection,
  collectionProgress,
  monthGrid,
  nextToCollect,
} from "./collection";
import { ROOMS, type Profile } from "./profile";

const base: Profile = {
  xp: 0,
  plays: {},
  best: {},
  cat: {},
  days: [],
  achievements: [],
  history: [],
};

describe("collection catalog", () => {
  it("has exactly one card per tracked room", () => {
    expect(COLLECTION.map((c) => c.room).sort()).toEqual([...ROOMS].sort());
    expect(COLLECTION.length).toBe(ROOMS.length);
  });
});

describe("collection state", () => {
  it("owns only rooms that have been played, with stats + first-played date", () => {
    const p: Profile = {
      ...base,
      plays: { board: 3, clock: 1 },
      best: { board: 4200 },
      history: [
        { room: "board", score: 100, ts: Date.UTC(2026, 5, 10, 9) },
        { room: "board", score: 4200, ts: Date.UTC(2026, 5, 12, 9) },
        { room: "clock", score: 50, ts: Date.UTC(2026, 5, 11, 9) },
      ],
    };
    const cards = collection(p);
    const board = cards.find((c) => c.room === "board")!;
    expect(board.owned).toBe(true);
    expect(board.plays).toBe(3);
    expect(board.best).toBe(4200);
    expect(board.since).toBe("2026-06-10"); // earliest of the two board entries
    expect(cards.find((c) => c.room === "map")!.owned).toBe(false);
  });

  it("counts progress and teases the next uncollected card in catalog order", () => {
    expect(collectionProgress(base)).toEqual({ have: 0, total: COLLECTION.length });
    expect(nextToCollect(base)!.room).toBe(COLLECTION[0].room);

    const p: Profile = { ...base, plays: { mystery: 1 } };
    expect(collectionProgress(p)).toEqual({ have: 1, total: COLLECTION.length });
    expect(nextToCollect(p)!.room).toBe(COLLECTION[1].room);
  });

  it("returns null when every card is collected", () => {
    const plays = Object.fromEntries(ROOMS.map((r) => [r, 1]));
    expect(nextToCollect({ ...base, plays })).toBeNull();
  });
});

describe("monthGrid", () => {
  const ref = new Date(Date.UTC(2026, 5, 26, 12)); // June 2026: starts on a Monday

  it("yields full Sun-first weeks covering the month", () => {
    const weeks = monthGrid([], ref);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // June 1 2026 is a Monday → first cell (Sunday) is a leading pad
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][1]).toMatchObject({ day: 1, inMonth: true, iso: "2026-06-01" });
    const flat = weeks.flat().filter((c) => c.inMonth);
    expect(flat).toHaveLength(30); // June has 30 days
  });

  it("lights played days and only those", () => {
    const weeks = monthGrid(["2026-06-10", "2026-05-31"], ref);
    const cells = weeks.flat();
    expect(cells.find((c) => c.iso === "2026-06-10")!.played).toBe(true);
    expect(cells.find((c) => c.iso === "2026-06-11")!.played).toBe(false);
    // a play outside the month doesn't appear as an in-month lit cell
    expect(cells.filter((c) => c.played && c.inMonth)).toHaveLength(1);
  });
});
