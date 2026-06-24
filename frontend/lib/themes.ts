// Daily themes for THE BOARD. A theme reskins the five column headers and the
// board's accent treatment. Chosen deterministically by date (daySeed) so every
// player sees the same theme — SSR/client agree (see lib/rng.ts).
//
// A theme maps each standard Category to a flavoured column label; where the
// day's data has no themed twist the standard CATEGORY_LABEL is used as a
// fallback (handled by themedLabel below).

import { mulberry32 } from "@/lib/rng";
import type { Category } from "@/lib/types";

export interface BoardTheme {
  /** keyword — also the tag the forge attaches to clue questions' meta */
  key: string;
  /** display name shown on the board frame */
  name: string;
  /** accent hex for the themed frame/glow (sits alongside CATEGORY_HEX) */
  accent: string;
  /** a glyph evoking the theme, drawn into the header art */
  glyph: string;
  /** themed labels per category; missing entries fall back to CATEGORY_LABEL */
  labels: Partial<Record<Category, string>>;
}

export const THEMES: BoardTheme[] = [
  {
    key: "egypt",
    name: "Egypt",
    accent: "#c8852a",
    glyph: "𓂀",
    labels: {
      history: "Dynasties",
      geography: "The Nile",
      screen: "Epics",
      music: "Hymns",
      sports: "Games of Kings",
      wildcard: "Relics",
    },
  },
  {
    key: "noir",
    name: "Noir",
    accent: "#7a7f8c",
    glyph: "🕵",
    labels: {
      history: "Cold Cases",
      geography: "The City",
      screen: "Pictures",
      music: "Torch Songs",
      sports: "The Fix",
      wildcard: "Loose Ends",
    },
  },
  {
    key: "voyage",
    name: "The Voyage",
    accent: "#178b99",
    glyph: "⚓",
    labels: {
      history: "Old Maps",
      geography: "Far Shores",
      screen: "Sea Tales",
      music: "Shanties",
      sports: "The Crew",
      wildcard: "Cargo",
    },
  },
  {
    key: "cosmos",
    name: "Cosmos",
    accent: "#7040a8",
    glyph: "✦",
    labels: {
      history: "Discoveries",
      geography: "Worlds",
      screen: "Space Operas",
      music: "Spheres",
      sports: "Zero-G",
      wildcard: "The Void",
    },
  },
  {
    key: "carnival",
    name: "Carnival",
    accent: "#b83468",
    glyph: "🎪",
    labels: {
      history: "Sideshows",
      geography: "The Midway",
      screen: "The Big Top",
      music: "Calliope",
      sports: "Feats",
      wildcard: "Marvels",
    },
  },
  {
    key: "deep-sea",
    name: "Deep Sea",
    accent: "#2b6ab5",
    glyph: "🜄",
    labels: {
      history: "Wrecks",
      geography: "The Trench",
      screen: "Abyss Tales",
      music: "Sirens",
      sports: "The Dive",
      wildcard: "Bioluminous",
    },
  },
  {
    key: "library",
    name: "The Library",
    accent: "#a87a2e",
    glyph: "📖",
    labels: {
      history: "Chronicles",
      geography: "Atlases",
      screen: "Adaptations",
      music: "Librettos",
      sports: "Almanacs",
      wildcard: "Marginalia",
    },
  },
];

/** The Secret Order character who hosts THE BOARD (see GAMES.md character canon). */
export const BOARD_HOST = {
  name: "The Host",
  title: "Keeper of the Board",
};

/** Deterministic theme of the day — same dayIndex ⇒ same theme for everyone. */
export function pickTheme(dayIndex: number): BoardTheme {
  const rand = mulberry32(0x5eed ^ dayIndex);
  return THEMES[Math.floor(rand() * THEMES.length)];
}

/** Themed label for a category, falling back to the standard label. */
export function themedLabel(
  theme: BoardTheme,
  category: Category,
  fallback: string,
): string {
  return theme.labels[category] ?? fallback;
}
