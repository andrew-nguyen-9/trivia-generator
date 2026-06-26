// The cross-room MOTIF of the day. Where lib/themes.ts reskins THE BOARD's
// columns, a motif is a day-level *subject* — "Music Night", "Moonshot '69" —
// that every room can pull from: a shared accent/glyph/blurb to reskin with, and
// a way to bias (feed) the room's daily pool toward the day's subject.
//
// Picked deterministically by date (daySeed) so every player on a given day sees
// the SAME motif everywhere — SSR and client agree (see lib/rng.ts; no
// Math.random, no clock read beyond the passed dayIndex).

import { daySeed, mulberry32 } from "./rng";
import type { Category } from "./types";

export interface Motif {
  /** stable id — also the tag the forge can attach to on-subject questions' meta */
  key: string;
  /** display name shown across rooms ("Music Night") */
  name: string;
  /** one-line framing every room can surface */
  blurb: string;
  /** shared accent hex every room can tint its frame/glow with */
  accent: string;
  /** a glyph evoking the subject */
  glyph: string;
  /** category every room leans toward; null for era/theme motifs with no lean */
  lean: Category | null;
  /** inclusive [start, end] years; an item dated inside the range is on-motif */
  years?: [number, number];
  /** lowercase substrings — an item whose text hits one is on-motif */
  match: string[];
  /** board skin (lib/themes.ts THEMES key) to keep THE BOARD visually in sync */
  boardThemeKey: string;
}

// Curated motifs. Each maps 1:1 to a board skin so THE BOARD's reskin stays in
// step with the day's subject. Mixes category leans (music/screen/…) with an
// era motif (lean: null, matched by year window instead of category).
export const MOTIFS: Motif[] = [
  {
    key: "music-night",
    name: "Music Night",
    blurb: "Tonight the whole parlor hums — every room leans into sound.",
    accent: "#b83468",
    glyph: "🎵",
    lean: "music",
    match: ["album", "song", "band", "single", "guitar", "opera", "symphony"],
    boardThemeKey: "carnival",
  },
  {
    key: "silver-screen",
    name: "Silver Screen",
    blurb: "Lights down — the day plays out like a double feature.",
    accent: "#7a7f8c",
    glyph: "🎬",
    lean: "screen",
    match: ["film", "movie", "actor", "director", "oscar", "series", "episode"],
    boardThemeKey: "noir",
  },
  {
    key: "the-arena",
    name: "The Arena",
    blurb: "Scoreboards everywhere — a day for the record books.",
    accent: "#a87a2e",
    glyph: "🏆",
    lean: "sports",
    match: ["champion", "league", "olympic", "final", "medal", "record", "team"],
    boardThemeKey: "library",
  },
  {
    key: "atlas-day",
    name: "Atlas Day",
    blurb: "Pack a map — every room wanders somewhere new.",
    accent: "#178b99",
    glyph: "🗺",
    lean: "geography",
    match: ["country", "capital", "river", "mountain", "island", "border", "ocean"],
    boardThemeKey: "voyage",
  },
  {
    key: "ages-past",
    name: "Ages Past",
    blurb: "The dust gets blown off — a day spent in the archives.",
    accent: "#c8852a",
    glyph: "𓂀",
    lean: "history",
    match: ["empire", "dynasty", "war", "revolution", "ancient", "king", "queen"],
    boardThemeKey: "egypt",
  },
  {
    key: "moonshot-69",
    name: "Moonshot '69",
    blurb: "1969 all day — the year of the Moon, Woodstock, and the rest.",
    accent: "#7040a8",
    glyph: "🚀",
    lean: null,
    years: [1965, 1972],
    match: ["apollo", "moon", "1969", "woodstock", "lunar", "armstrong"],
    boardThemeKey: "cosmos",
  },
  {
    key: "deep-cuts",
    name: "Deep Cuts",
    blurb: "Off the beaten path — the parlor goes looking for oddities.",
    accent: "#2b6ab5",
    glyph: "🜄",
    lean: "wildcard",
    match: ["myth", "legend", "mystery", "curious", "unusual", "rare"],
    boardThemeKey: "deep-sea",
  },
];

/** Deterministic motif of the day — same dayIndex ⇒ same motif for everyone. */
export function motifOfDay(dayIndex: number = daySeed()): Motif {
  // distinct seed salt from pickTheme's so the motif rotation isn't lockstep
  // with anything else keyed off the bare dayIndex.
  const rand = mulberry32(0x310f ^ dayIndex);
  return MOTIFS[Math.floor(rand() * MOTIFS.length)];
}

/** The minimal shape any room projects an item into so the motif can judge it. */
export interface MotifSubject {
  category?: Category;
  year?: number | null;
  /** any searchable text — typically prompt + answer concatenated */
  text?: string;
}

/** True when an item is "on-motif": category lean, year window, or text match. */
export function onMotif(s: MotifSubject, m: Motif): boolean {
  if (m.lean && s.category === m.lean) return true;
  if (m.years && s.year != null && s.year >= m.years[0] && s.year <= m.years[1]) {
    return true;
  }
  if (s.text) {
    const hay = s.text.toLowerCase();
    if (m.match.some((needle) => hay.includes(needle))) return true;
  }
  return false;
}

// Bias a room's pool toward the day's motif: on-motif items float to the front,
// everything else keeps its order behind them. A STABLE partition — it layers on
// top of an existing daily rotation (lib/rng pickRotating/dailyOrder) instead of
// reshuffling it, so it stays SSR-deterministic. Pure: no clock, no randomness.
export function feedByMotif<T>(
  pool: T[],
  m: Motif,
  project: (item: T) => MotifSubject,
): T[] {
  const on: T[] = [];
  const off: T[] = [];
  for (const item of pool) (onMotif(project(item), m) ? on : off).push(item);
  return [...on, ...off];
}
