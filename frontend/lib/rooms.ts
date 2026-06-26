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

/**
 * Canonical game registry — order mirrors the home page rank. The home page's
 * playing-card deck (`app/page.tsx` `GAMES[]`) is the curated ten-card poker
 * deck; this registry is the broader source for sitemap/metadata/footer and
 * also carries rooms not (yet) on the poker deck. New rooms register HERE in
 * §3.0 so later segments add only their own files (PLATFORM.md §3.0 firewall).
 */
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
    path: "/gauntlet",
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
  // ── New v3 rooms — routes + registry reserved in §3.0; built in Wave D.
  // Placeholder pages live in their own route dirs until the owning segment
  // (3.22 / 3.23) replaces them, so neither segment edits this shared file. ──
  {
    path: "/overture",
    name: "The Overture",
    title: "The Overture — name the intro",
    description:
      "The parlor strikes up an overture. Name the track before the needle lifts — a music room for the sharp-eared. (Opens soon.)",
    accent: "music",
    kind: "game",
  },
  {
    path: "/cold-case",
    name: "The Cold Case",
    title: "The Cold Case — the week-long mystery",
    description:
      "One unsolved case, opened across a week. Follow clues from every room of the Order to name the culprit. (Opens soon.)",
    accent: "history",
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
