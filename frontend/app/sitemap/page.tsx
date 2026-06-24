import Link from "next/link";
import { GAME_ROOMS, SYSTEM_ROOMS, roomMetadata } from "@/lib/rooms";
import { CATEGORY_HEX } from "@/lib/types";

export const metadata = roomMetadata("/sitemap");

const SUIT: Record<string, string> = {
  history: "♦",
  music: "♥",
  sports: "♣",
  screen: "♠",
  geography: "✦",
  wildcard: "✧",
};

function RoomRow({
  path,
  name,
  description,
  accent,
}: {
  path: string;
  name: string;
  description: string;
  accent: string;
}) {
  const hex = CATEGORY_HEX[accent as keyof typeof CATEGORY_HEX] ?? "#a87a2e";
  return (
    <li>
      <Link
        href={path}
        className="group flex items-baseline gap-3 rounded-md border border-transparent px-3 py-2.5 transition hover:border-line hover:bg-surface/40"
      >
        <span className="text-sm" style={{ color: hex }} aria-hidden>
          {SUIT[accent] ?? "✦"}
        </span>
        <span className="flex-1">
          <span className="display text-base text-ink transition group-hover:text-gold">
            {name}
          </span>
          <span className="block text-sm text-muted">{description}</span>
        </span>
        <span className="microlabel opacity-40 transition group-hover:opacity-80">
          {path}
        </span>
      </Link>
    </li>
  );
}

export default function SitemapPage() {
  const pages = SYSTEM_ROOMS; // includes home, about, this page, profile
  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-24 pt-10 sm:px-8">
      <div className="glow" style={{ background: "#7040a8" }} aria-hidden />

      <header className="relative z-10 mx-auto max-w-3xl">
        <Link href="/" className="microlabel text-brass transition hover:text-gold">
          ← the lobby
        </Link>
        <h1 className="gilt display mt-8 text-[clamp(2.4rem,8vw,4.5rem)] leading-none">
          The Sitemap
        </h1>
        <p className="mt-4 max-w-lg text-sm text-muted">
          Every room and every door in the parlor. The machines read{" "}
          <Link href="/sitemap.xml" className="text-brass underline-offset-2 hover:underline">
            sitemap.xml
          </Link>
          ; this one is for you.
        </p>
      </header>

      <section className="relative z-10 mx-auto mt-12 max-w-3xl">
        <p className="microlabel mb-2 text-brass">the rooms · the deck</p>
        <ul className="brass-rule border-t pt-2">
          {GAME_ROOMS.map((r) => (
            <RoomRow key={r.path} {...r} />
          ))}
        </ul>
      </section>

      <section className="relative z-10 mx-auto mt-12 max-w-3xl">
        <p className="microlabel mb-2 text-brass">the order · pages</p>
        <ul className="brass-rule border-t pt-2">
          {pages.map((r) => (
            <RoomRow key={r.path} {...r} />
          ))}
        </ul>
      </section>
    </main>
  );
}
