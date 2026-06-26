// THE COLLECTION (§3.20) — generalises the Séance's lib/grimoire.ts from a single
// room's archive into a cross-room set: one card per room, earned the first time you
// finish it, plus a completed-days calendar. The return loop = collect every card +
// keep the calendar lit. Both views derive from what lib/profile.ts already keeps in
// localStorage (plays / best / days / history) — no new writes, no room edits. Pure.

import type { Profile, Room } from "./profile";
import { ROOMS } from "./profile";
import type { Category } from "./types";

// One collectible per tracked room. label + accent suit mirror the deck
// (app/page.tsx / lib/rooms.ts). Single source for the dashboard's room labels too.
export interface Collectible {
  room: Room;
  label: string;
  accent: Category;
  href: string;
}

export const COLLECTION: Collectible[] = [
  { room: "mystery", label: "Sanctum Mysterii", accent: "history", href: "/mystery" },
  { room: "board", label: "Codex", accent: "history", href: "/board" },
  { room: "clock", label: "Chronos", accent: "music", href: "/clock" },
  { room: "wedges", label: "Fractures", accent: "sports", href: "/wedges" },
  { room: "streak", label: "Ignite", accent: "screen", href: "/streak" },
  { room: "map", label: "Atlas Obscura", accent: "geography", href: "/map" },
  { room: "daily", label: "The Gauntlet", accent: "wildcard", href: "/gauntlet" },
  { room: "jukebox", label: "The Jukebox", accent: "music", href: "/jukebox" },
  { room: "gallery", label: "The Gallery", accent: "screen", href: "/gallery" },
  { room: "blitz", label: "The Blitz", accent: "history", href: "/blitz" },
  { room: "connections", label: "The Connections", accent: "wildcard", href: "/connections" },
];

export interface CollectedCard extends Collectible {
  owned: boolean;
  plays: number;
  best: number;
  since?: string; // YYYY-MM-DD first earned (from history, if still in the window)
}

/** Earliest play-date per room, derived from the (capped) history ring. */
function firstPlayed(history: Profile["history"]): Partial<Record<Room, string>> {
  const out: Partial<Record<Room, number>> = {};
  for (const h of history) {
    if (out[h.room] === undefined || h.ts < out[h.room]!) out[h.room] = h.ts;
  }
  const iso: Partial<Record<Room, string>> = {};
  for (const [room, ts] of Object.entries(out)) {
    iso[room as Room] = new Date(ts!).toISOString().slice(0, 10);
  }
  return iso;
}

/** Every card with its owned/earned state — the collection grid. */
export function collection(p: Profile): CollectedCard[] {
  const since = firstPlayed(p.history);
  return COLLECTION.map((c) => ({
    ...c,
    owned: (p.plays[c.room] ?? 0) > 0,
    plays: p.plays[c.room] ?? 0,
    best: p.best[c.room] ?? 0,
    since: since[c.room],
  }));
}

/** Cards collected vs total — the headline progress number. */
export function collectionProgress(p: Profile): { have: number; total: number } {
  const have = COLLECTION.filter((c) => (p.plays[c.room] ?? 0) > 0).length;
  return { have, total: COLLECTION.length };
}

/** The next uncollected card to tease as a come-back CTA; null once complete. */
export function nextToCollect(p: Profile): Collectible | null {
  return COLLECTION.find((c) => !(p.plays[c.room] ?? 0)) ?? null;
}

export interface CalendarCell {
  iso: string; // YYYY-MM-DD (UTC, matching how the profile stamps days)
  day: number; // 1..31
  played: boolean;
  today: boolean;
  inMonth: boolean; // false for leading/trailing pad days
}

const isoUTC = (y: number, m: number, d: number) =>
  // noon UTC keeps the slice on the intended calendar day regardless of tz
  new Date(Date.UTC(y, m, d, 12)).toISOString().slice(0, 10);

/** Sun-first weeks covering the month of `ref`, padded to full weeks. The played
 *  set + "today" use the same UTC date form lib/profile.ts records, so a player's
 *  timezone can't light the wrong cell. */
export function monthGrid(days: string[], ref: Date = new Date()): CalendarCell[][] {
  const played = new Set(days);
  const todayIso = new Date().toISOString().slice(0, 10);
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const firstDow = new Date(Date.UTC(y, m, 1, 12)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();

  const cells: CalendarCell[] = [];
  const total = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const day = i - firstDow + 1; // 1-based day-of-month; <1 or >max ⇒ pad
    const iso = isoUTC(y, m, day);
    cells.push({
      iso,
      day,
      inMonth: day >= 1 && day <= daysInMonth,
      played: played.has(iso),
      today: iso === todayIso,
    });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ponytail: keep COLLECTION in lockstep with the profile's tracked rooms.
if (
  process.env.NODE_ENV !== "production" &&
  (COLLECTION.length !== ROOMS.length ||
    !ROOMS.every((r) => COLLECTION.some((c) => c.room === r)))
) {
  // eslint-disable-next-line no-console
  console.warn("[collection] catalog out of sync with profile ROOMS");
}
