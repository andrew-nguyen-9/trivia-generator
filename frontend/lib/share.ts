// PARLOR v3 §3.0 — the single share seam.
//
// Every game produces a `GameResult`; this module turns it into the canonical
// social artifacts: a Wordle-style emoji grid (clipboard text) and a link whose
// OG card (app/api/og/[room]) previews the run. Sharing is pure off day-seeded
// determinism — NO database writes, NO accounts (the v3 invariant). Games import
// this without touching any shared file; later social segments (§3.14) APPEND
// here, they don't fork it.
//
// A round's outcome is one of four tiers, mapped to a coloured square:
//   hit  🟩  fully correct / best band
//   near 🟨  close / partial credit
//   miss ⬛  wrong / no credit
//   blank ⬜  unplayed / skipped round
import { SITE_URL, roomByPath } from "./rooms";

export type Tier = "hit" | "near" | "miss" | "blank";

/** What every game hands to the share layer. `room` is the route path
 *  (e.g. "/gauntlet"), `date` the day-seed (YYYY-MM-DD), `tiers` one entry per
 *  round in play order. `columns` wraps the grid (e.g. 5 for a 5×N board). */
export interface GameResult {
  room: string;
  date: string;
  tiers: Tier[];
  score?: number;
  maxScore?: number;
  columns?: number;
}

const SQUARE: Record<Tier, string> = {
  hit: "🟩",
  near: "🟨",
  miss: "⬛",
  blank: "⬜",
};

// One char per tier — compact, URL-safe encoding shared with the OG endpoint so
// a share link can reconstruct the exact grid without a DB round-trip.
const TIER_TO_CODE: Record<Tier, string> = { hit: "h", near: "n", miss: "m", blank: "b" };
const CODE_TO_TIER: Record<string, Tier> = { h: "hit", n: "near", m: "miss", b: "blank" };

export function encodeTiers(tiers: Tier[]): string {
  return tiers.map((t) => TIER_TO_CODE[t]).join("");
}

/** Inverse of encodeTiers; unknown chars decode to "blank" (forgiving on bad input). */
export function decodeTiers(code: string): Tier[] {
  return [...(code ?? "")].map((c) => CODE_TO_TIER[c] ?? "blank");
}

/** The emoji grid alone. `columns` wraps into rows; falsy ⇒ one line. */
export function emojiGrid(tiers: Tier[], columns?: number): string {
  const cells = tiers.map((t) => SQUARE[t]);
  if (!columns || columns <= 0) return cells.join("");
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += columns) {
    rows.push(cells.slice(i, i + columns).join(""));
  }
  return rows.join("\n");
}

export interface ShareCard {
  title: string; // "PARLOR · The Gauntlet"
  grid: string; // the emoji block
  text: string; // full clipboard/share blob (title + score + grid + url)
  url: string; // link to the room (its OG card previews this run)
  ogImage: string; // absolute URL of the per-run OG card image
}

const roomName = (path: string) => roomByPath(path)?.name ?? "PARLOR";

/** Absolute OG-card URL for a result. The endpoint (app/api/og/[room]) reads
 *  these params and renders the share image; games never edit the endpoint. */
export function ogImageUrl(result: GameResult, siteUrl: string = SITE_URL): string {
  const room = result.room.replace(/^\//, "");
  const q = new URLSearchParams({ g: encodeTiers(result.tiers), d: result.date });
  if (result.score != null) q.set("s", String(result.score));
  if (result.maxScore != null) q.set("m", String(result.maxScore));
  return `${siteUrl}/api/og/${encodeURIComponent(room)}?${q.toString()}`;
}

// ── §3.14 — per-room share-card art ──────────────────────────────────────
// Each room gets a persona eyebrow + a card-suit emblem. The OG endpoint
// (app/api/og/[room]) and the in-app ShareCardGallery both read this so the
// motif has ONE source. Suits only (♠♦♣♥) — they render in next/og without a
// font dependency, same as the endpoint's footer. Unknown rooms fall back to
// the generic Order frame, so this is safe for any future room.
export interface RoomArt {
  persona: string; // mystery-voice eyebrow, e.g. "The Clockkeeper"
  suit: string; // emblem glyph, one of ♠ ♦ ♣ ♥
}

const ROOM_ART: Record<string, RoomArt> = {
  "/mystery": { persona: "Sanctum Mysterii", suit: "♠" },
  "/board": { persona: "The Daily Board", suit: "♦" },
  "/clock": { persona: "The Clockkeeper", suit: "♣" },
  "/wedges": { persona: "The Shattered Mirror", suit: "♠" },
  "/streak": { persona: "The Open Flame", suit: "♥" },
  "/map": { persona: "The Cartographer", suit: "♦" },
  "/gauntlet": { persona: "The Gauntlet", suit: "♠" },
  "/thread": { persona: "The Weaver", suit: "♣" },
  "/seance": { persona: "The Medium", suit: "♥" },
  "/ladder": { persona: "The Initiate's Climb", suit: "♦" },
  "/overture": { persona: "The Overture", suit: "♥" },
  "/cold-case": { persona: "The Cold Case", suit: "♣" },
};

const DEFAULT_ART: RoomArt = { persona: "The Secret Order", suit: "♠" };

/** Per-room card art (persona eyebrow + suit emblem). Accepts a path with or
 *  without leading slash; unknown rooms get the generic Order frame. */
export function roomArt(path: string): RoomArt {
  const key = path.startsWith("/") ? path : `/${path}`;
  return ROOM_ART[key] ?? DEFAULT_ART;
}

/** Build the full shareable card for a finished run. */
export function buildShare(result: GameResult, siteUrl: string = SITE_URL): ShareCard {
  const title = `PARLOR · ${roomName(result.room)}`;
  const grid = emojiGrid(result.tiers, result.columns);
  const url = `${siteUrl}${result.room}`;
  const scoreLine =
    result.score != null
      ? `${result.score}${result.maxScore != null ? `/${result.maxScore}` : ""} · ${result.date}`
      : result.date;
  return {
    title,
    grid,
    url,
    ogImage: ogImageUrl(result, siteUrl),
    text: `${title}\n${scoreLine}\n${grid}\n${url}`,
  };
}
