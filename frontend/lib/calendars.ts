// Rotating CALENDAR SYSTEMS for THE CLOCK. The calendar of the day restyles how
// a year is displayed and occasionally poses a conversion puzzle. Chosen
// deterministically by date (daySeed) so every player sees the same calendar —
// SSR/client agree (see lib/rng.ts). Mirrors the daily-theme pattern in
// lib/themes.ts.
//
// Every conversion here is a PURE function of the Gregorian year: offline,
// deterministic, no I/O. They are intentionally simplified (year-granular)
// almanac conventions — enough to read a year in another system, not to settle
// a historian's argument.

import { mulberry32 } from "./rng";

/**
 * Serializable calendar descriptor (safe to pass server → client). The
 * conversion itself is keyed, not embedded as a function, so a Server Component
 * can hand this straight to the client clock — call `labelFor(key, year)` there.
 */
export interface CalendarSystem {
  /** stable id — also the lookup key for labelFor() */
  key: string;
  /** display name shown on the clock frame */
  name: string;
  /** accent hex for the dial styling (sits alongside CATEGORY_HEX) */
  accent: string;
  /** glyph evoking the system, drawn on the dial */
  glyph: string;
  /** a one-line read-out of how this system frames a year */
  blurb: string;
}

/** pure conversions keyed by CalendarSystem.key (not on the serialized object). */
const CONVERTERS: Record<string, (gregorianYear: number) => string> = {
  gregorian: (y) => String(y),
  mayan: (y) => mayanLongCount(y),
  "french-republican": (y) => frenchRepublicanYear(y),
  holocene: (y) => holoceneYear(y),
  regnal: (y) => centuryLabel(y),
};

/** A Gregorian year → the day-calendar's label. Pure, offline, deterministic. */
export function labelFor(key: string, gregorianYear: number): string {
  return (CONVERTERS[key] ?? CONVERTERS.gregorian)(gregorianYear);
}

// ── pure conversions (year granularity) ──────────────────────────────────────

/** Mayan Long Count baktun.katun for Jan 1 of a Gregorian year (≈ GMT-correlated). */
export function mayanLongCount(year: number): string {
  // Days since the Long Count epoch (11 Aug 3114 BCE) to Jan 1 of `year`,
  // approximated at year granularity via the Julian Day Number of Jan 1.
  const jdn = gregorianToJDN(year, 1, 1);
  const epoch = 584283; // GMT correlation constant (Julian Day of 0.0.0.0.0)
  let days = jdn - epoch;
  const baktun = Math.floor(days / 144000);
  days -= baktun * 144000;
  const katun = Math.floor(days / 7200);
  days -= katun * 7200;
  const tun = Math.floor(days / 360);
  return `${baktun}.${katun}.${tun}`;
}

/** French Republican year (An I began 22 Sep 1792). */
export function frenchRepublicanYear(year: number): string {
  const n = year - 1791; // An I = 1792
  if (n <= 0) return "before An I";
  return `An ${toRoman(n)}`;
}

/** Holocene / Human Era — add 10,000 to the Gregorian year. */
export function holoceneYear(year: number): string {
  return `${year + 10000} HE`;
}

/** Regnal-style century framing — keeps the year but names its century ordinal. */
export function centuryLabel(year: number): string {
  const c = Math.floor((year - 1) / 100) + 1;
  return `${ordinal(c)} century`;
}

/** Julian Day Number for a Gregorian calendar date (proleptic). */
export function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

function toRoman(num: number): string {
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = num;
  let out = "";
  for (const [v, s] of table) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── the rotating systems ──────────────────────────────────────────────────────

export const CALENDARS: CalendarSystem[] = [
  {
    key: "gregorian",
    name: "Gregorian",
    accent: "#c8852a",
    glyph: "☉",
    blurb: "The civil reckoning, anno Domini.",
  },
  {
    key: "mayan",
    name: "Mayan Long Count",
    accent: "#2d9155",
    glyph: "𝋠",
    blurb: "Baktun.katun.tun since the Third Creation.",
  },
  {
    key: "french-republican",
    name: "French Republican",
    accent: "#2b6ab5",
    glyph: "⚜",
    blurb: "Years of the Republic, since 1792.",
  },
  {
    key: "holocene",
    name: "Holocene Era",
    accent: "#7040a8",
    glyph: "🜨",
    blurb: "The Human Era — ten millennia added.",
  },
  {
    key: "regnal",
    name: "By the Century",
    accent: "#b83468",
    glyph: "⌛",
    blurb: "The age named by its century.",
  },
];

/** The Secret Order horologist who tends THE CLOCK (see GAMES.md character canon). */
export const CLOCKKEEPER = {
  name: "The Clockkeeper",
  title: "Horologist of the Order",
};

/** Deterministic calendar of the day — same dayIndex ⇒ same system for everyone. */
export function pickCalendar(dayIndex: number): CalendarSystem {
  const rand = mulberry32(0xc10c4 ^ dayIndex);
  return CALENDARS[Math.floor(rand() * CALENDARS.length)];
}
