import Link from "next/link";
import { GAME_ROOMS, SYSTEM_ROOMS, PARENT_SITE } from "@/lib/rooms";

// Site-wide footer (PLATFORM §2.19): a brass plate at the foot of every page,
// with navigation through the rooms and back out to the umbrella an9.dev site.
const SYSTEM_LINKS = SYSTEM_ROOMS.filter((r) => r.path !== "/");

export default function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-line bg-surface/40 px-4 py-12 sm:px-8">
      {/* engraved divider flourish */}
      <div className="mx-auto mb-10 flex max-w-5xl items-center gap-3">
        <span className="text-xs text-brass opacity-40">✦</span>
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-brass opacity-40">♠</span>
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-brass opacity-40">✦</span>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        {/* Brand + exit to an9.dev */}
        <div>
          <Link href="/" className="flex items-center gap-3 transition hover:opacity-80">
            <img
              src="/logo-96.png"
              alt="The Parlor"
              width={36}
              height={40}
              className="h-9 w-auto drop-shadow-[0_2px_8px_rgba(110,31,43,0.5)]"
            />
            <span className="display gilt text-2xl leading-none">Parlor</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">
            A secret order of the curious. Ten rooms, one velvet door — trivia
            forged nightly and a new mystery every dusk.
          </p>
          <a
            href={PARENT_SITE.href}
            className="microlabel mt-5 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-brass transition hover:border-brass hover:text-gold"
          >
            <span aria-hidden>←</span> back to {PARENT_SITE.label}
          </a>
        </div>

        {/* The rooms */}
        <nav aria-label="Rooms">
          <p className="microlabel mb-3 text-brass">the rooms</p>
          <ul className="space-y-1.5">
            {GAME_ROOMS.map((room) => (
              <li key={room.path}>
                <Link
                  href={room.path}
                  className="text-sm text-muted transition hover:text-ink"
                >
                  {room.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* The order */}
        <nav aria-label="The Order">
          <p className="microlabel mb-3 text-brass">the order</p>
          <ul className="space-y-1.5">
            {SYSTEM_LINKS.map((room) => (
              <li key={room.path}>
                <Link
                  href={room.path}
                  className="text-sm text-muted transition hover:text-ink"
                >
                  {room.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-12 max-w-5xl border-t border-line pt-6">
        <p className="microlabel text-muted">
          data · wikipedia rest api · deezer api · sleeper api · espn · tmdb — this
          product uses the TMDB API but is not endorsed or certified by TMDB
        </p>
      </div>
    </footer>
  );
}
