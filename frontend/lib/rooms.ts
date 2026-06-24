import type { Metadata } from "next";
import type { Category } from "@/lib/types";

/**
 * Canonical route registry — single source for SEO (sitemap.ts, robots.ts,
 * per-route metadata) and human navigation (the sitemap page + site footer).
 *
 * `title` is the bare phrase; the root layout's title template appends "· PARLOR".
 * `description` is the mystery-voice meta description (aim ~150 chars).
 * Keep `path` leading-slash-prefixed; "/" is the threshold (home).
 */

export type RoomKind = "feature" | "game" | "system";

export interface RoomMeta {
  path: string;
  name: string;
  title: string;
  description: string;
  accent: Category;
  kind: RoomKind;
}

/** The ten cards of the deck — order mirrors the home page rank. */
export const GAME_ROOMS: RoomMeta[] = [
  {
    path: "/mystery",
    name: "Sanctum Mysterii",
    title: "Sanctum Mysterii — the nightly murder",
    description:
      "A new case every dusk. Read the dossiers, follow the clues, and name the culprit before the candle gutters out.",
    accent: "history",
    kind: "feature",
  },
  {
    path: "/board",
    name: "Codex",
    title: "Codex — the daily board",
    description:
      "Five categories, five values, one daily double. The same engraved board for every member of the Order, every day.",
    accent: "history",
    kind: "game",
  },
  {
    path: "/clock",
    name: "Chronos",
    title: "Chronos — when did it happen?",
    description:
      "Drag the year against the century. Closer guesses earn bigger points — five rounds with the Clockkeeper.",
    accent: "music",
    kind: "game",
  },
  {
    path: "/wedges",
    name: "Fractures",
    title: "Fractures — fill the ring",
    description:
      "Six wedges, twenty questions, one shattered mirror. Quickfire across every category before the deck runs dry.",
    accent: "sports",
    kind: "game",
  },
  {
    path: "/streak",
    name: "Ignite",
    title: "Ignite — higher or lower",
    description:
      "Populations, box offices, fan counts — higher or lower? One wrong call snuffs the flame and ends the run.",
    accent: "screen",
    kind: "game",
  },
  {
    path: "/map",
    name: "Atlas Obscura",
    title: "Atlas Obscura — drop the pin",
    description:
      "Drop a pin where it happened. Scored by the kilometer — antique cartography, no tile servers, no mercy.",
    accent: "geography",
    kind: "game",
  },
  {
    path: "/daily",
    name: "The Gauntlet",
    title: "The Gauntlet — one run a day",
    description:
      "One round from every room, once a day, the same gauntlet for everyone. Share your line of squares.",
    accent: "wildcard",
    kind: "game",
  },
  {
    path: "/thread",
    name: "Thread of Fate",
    title: "Thread of Fate — follow the chain",
    description:
      "Each answer links to the next. Follow the Weaver's chain of clues and unravel the thread before it tangles.",
    accent: "history",
    kind: "game",
  },
  {
    path: "/seance",
    name: "The Séance",
    title: "The Séance — who or what am I?",
    description:
      "Each clue costs a point. Commune with the Medium and name the spirit early — the soonest answer earns the most.",
    accent: "wildcard",
    kind: "game",
  },
  {
    path: "/ladder",
    name: "Climb of the Initiate",
    title: "Climb of the Initiate — closest match",
    description:
      "Pick the closest match. Hints reveal shared attributes — category, region, magnitude. Climb rung by rung.",
    accent: "music",
    kind: "game",
  },
  {
    path: "/jukebox",
    name: "The Jukebox",
    title: "The Jukebox — name the tune",
    description:
      "The parlor's brass jukebox spins a hook. Name the song before the needle lifts — a music room for the sharp-eared.",
    accent: "music",
    kind: "game",
  },
  {
    path: "/gallery",
    name: "The Gallery",
    title: "The Gallery — name the picture",
    description:
      "Portraits and stills line the gallery walls. Name what you see on screen before the curator moves you along.",
    accent: "screen",
    kind: "game",
  },
  {
    path: "/blitz",
    name: "The Blitz",
    title: "The Blitz — beat the clock",
    description:
      "Answers against a falling timer. A rapid-fire history room for members who think faster than the candle burns.",
    accent: "history",
    kind: "game",
  },
  {
    path: "/connections",
    name: "The Connections",
    title: "The Connections — find the four groups",
    description:
      "Sixteen tiles, four hidden bonds. Sort the grid into its secret groups before the Order runs out of patience.",
    accent: "wildcard",
    kind: "game",
  },
  {
    path: "/lobby",
    name: "The Lobby",
    title: "The Lobby — play together",
    description:
      "Gather other members and play the rooms head to head. The multiplayer antechamber of the Secret Order.",
    accent: "wildcard",
    kind: "game",
  },
];

/** Non-game pages that still deserve unique metadata + a sitemap entry. */
export const SYSTEM_ROOMS: RoomMeta[] = [
  {
    path: "/",
    name: "The Parlor",
    title: "PARLOR — a secret order of the curious",
    description:
      "Ten rooms behind one velvet door — trivia forged nightly and a new murder mystery every dusk. Draw a card; the house always keeps a secret.",
    accent: "history",
    kind: "system",
  },
  {
    path: "/about",
    name: "About the Order",
    title: "About the Secret Order",
    description:
      "Who keeps the parlor, where the questions come from, and why the candle never quite goes out. The lore behind PARLOR.",
    accent: "history",
    kind: "system",
  },
  {
    path: "/sitemap",
    name: "Sitemap",
    title: "Sitemap — every room, every door",
    description:
      "A human-readable index of every room and page in the parlor. Find your way through the Secret Order.",
    accent: "wildcard",
    kind: "system",
  },
  {
    path: "/profile",
    name: "Your Card",
    title: "Your Card — the back office",
    description:
      "Your standing with the Order: streaks, badges, and the line of squares you have left behind.",
    accent: "wildcard",
    kind: "system",
  },
];

/** All routes that belong in the XML sitemap and per-route metadata. */
export const ALL_ROOMS: RoomMeta[] = [...SYSTEM_ROOMS, ...GAME_ROOMS];

/** Lookup by route path, e.g. byPath("/board"). */
export function roomByPath(path: string): RoomMeta | undefined {
  return ALL_ROOMS.find((r) => r.path === path);
}

/** Absolute base URL for canonical/OG links; override per deploy via env. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://parlor.an9.dev"
).replace(/\/$/, "");

/** The umbrella site the footer links back to. */
export const PARENT_SITE = { label: "an9.dev", href: "https://an9.dev" };

/**
 * Build a Next `Metadata` for a route from its registry entry. Pages export
 * `export const metadata = roomMetadata("/board")` — one line, unique per route,
 * canonical + OG/Twitter all derived from the single source above.
 */
export function roomMetadata(path: string): Metadata {
  const room = roomByPath(path);
  if (!room) return {};
  const url = path === "/" ? "/" : path;
  return {
    title: room.title,
    description: room.description,
    alternates: { canonical: url },
    openGraph: {
      title: room.title,
      description: room.description,
      url,
    },
    twitter: {
      title: room.title,
      description: room.description,
    },
  };
}
