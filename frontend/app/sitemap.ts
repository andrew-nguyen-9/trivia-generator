import type { MetadataRoute } from "next";
import { ALL_ROOMS, SITE_URL } from "@/lib/rooms";

// Daily rooms (board/clock/daily/...) refresh nightly with the question bank;
// system pages are effectively static. Both still get crawled — the hint just
// nudges recrawl cadence.
const DAILY = new Set(["game", "feature"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ALL_ROOMS.map((room) => ({
    url: `${SITE_URL}${room.path === "/" ? "" : room.path}`,
    lastModified: now,
    changeFrequency: DAILY.has(room.kind) ? "daily" : "weekly",
    priority: room.path === "/" ? 1 : room.kind === "feature" ? 0.9 : 0.7,
  }));
}
