// THE GRIMOIRE — the Séance's meta-progression. A localStorage archive of the
// spirits the medium has stabilised, with the best (lowest) time and the day it
// was banished. Client-only, best-effort (same convention as lib/profile.ts):
// the frontend never writes the database.

const KEY = "parlor.grimoire.v1";

export interface GrimoireEntry {
  spirit: string;
  date: string; // YYYY-MM-DD of the banishing
  rite: string; // the weekday rite at the time
  seconds: number; // best total time (incl. penalties)
  strikes: number; // poltergeist strikes on the best run
}

export type Grimoire = Record<string, GrimoireEntry>; // keyed by `${spirit}|${date}`

export function loadGrimoire(): Grimoire {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Grimoire) : {};
  } catch {
    return {};
  }
}

/** Record a banishing; keeps the faster run if the day was already solved. */
export function recordBanishing(entry: GrimoireEntry): Grimoire {
  const g = loadGrimoire();
  const k = `${entry.spirit}|${entry.date}`;
  if (!g[k] || entry.seconds < g[k].seconds) g[k] = entry;
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    // quota / private mode — best-effort
  }
  return g;
}

/** Unique spirits ever banished (for the collection count). */
export function spiritsBanished(g: Grimoire): string[] {
  return [...new Set(Object.values(g).map((e) => e.spirit))];
}
