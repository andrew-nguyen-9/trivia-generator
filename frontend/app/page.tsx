import Link from "next/link";
import Marquee from "@/components/Marquee";
import RoomCard from "@/components/RoomCard";
import SoundToggle from "@/components/SoundToggle";
import { isSupabaseConfigured } from "@/lib/supabase";

const TICKER = [
  "forged nightly from Wikipedia · Deezer · Sleeper · ESPN · TMDB",
  "the rite of spring caused a riot in 1913",
  "saturn has the most confirmed moons",
  "canberra, not sydney",
  "9.58 seconds — usain bolt, 2009",
  "rosebud was a sled",
  "south africa has three capitals",
  "name that tune in the jukebox",
];

const ROOMS = [
  {
    href: "/board",
    name: "The Board",
    accent: "history" as const,
    blurb:
      "Five categories, five values, one daily double. Easy multiple-choice or hard free-text — same board for everyone, every day.",
  },
  {
    href: "/clock",
    name: "The Clock",
    accent: "music" as const,
    blurb:
      "When did it happen? Drag the year. Closer guesses, bigger points — burn a hint if you're stuck.",
  },
  {
    href: "/wedges",
    name: "The Wedges",
    accent: "sports" as const,
    blurb:
      "Six wedges, twenty questions. Fill the ring before the deck runs out — quickfire across every category.",
  },
  {
    href: "/streak",
    name: "The Streak",
    accent: "screen" as const,
    blurb:
      "Higher or lower? Populations, box offices, fan counts. One wrong call ends the run.",
  },
  {
    href: "/map",
    name: "The Map",
    accent: "geography" as const,
    blurb:
      "Drop a pin where it happened. Scored by the kilometer, on a real satellite map or the offline atlas.",
  },
  {
    href: "/jukebox",
    name: "The Jukebox",
    accent: "music" as const,
    blurb:
      "Name that tune. Synthesized melodies and chart previews — four guesses, one clip, no spoilers.",
  },
  {
    href: "/gallery",
    name: "The Gallery",
    accent: "screen" as const,
    blurb:
      "Guess the flag, poster or place as it sharpens from a blur. The earlier you call it, the more it's worth.",
  },
  {
    href: "/blitz",
    name: "The Blitz",
    accent: "history" as const,
    blurb:
      "Sixty seconds, as many as you can. Combos buy time, misses cost it. Pure speed.",
  },
  {
    href: "/connections",
    name: "The Connections",
    accent: "wildcard" as const,
    blurb:
      "Sixteen tiles, four hidden groups, four mistakes. Find the thread before you run out.",
  },
  {
    href: "/daily",
    name: "The Daily",
    accent: "wildcard" as const,
    blurb:
      "One round from every room, once a day, same gauntlet for everyone. Share your line of squares.",
  },
  {
    href: "/lobby",
    name: "The Lobby",
    accent: "wildcard" as const,
    blurb:
      "Live multiplayer. First to buzz in answers the question. Create a room, share the code, play together.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="glow" style={{ background: "#b07aff" }} aria-hidden />

      <section className="relative z-10 flex min-h-[78vh] flex-col justify-end px-4 pb-10 pt-10 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <span className="microlabel">an after-dark house of trivia games</span>
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="microlabel rounded-full border border-line bg-surface/70 px-3 py-1.5 backdrop-blur transition hover:border-ink"
            >
              ♦ your card
            </Link>
            <SoundToggle />
            <span className="microlabel hidden sm:inline">
              {isSupabaseConfigured() ? "live bank" : "nightly deck"}
            </span>
          </div>
        </div>
        <h1 className="display mt-auto text-[clamp(4rem,18vw,14rem)]">Parlor</h1>
        <p className="max-w-xl text-sm text-muted sm:text-base">
          Eleven rooms. One question bank, forged nightly from Wikipedia, Deezer,
          Sleeper/ESPN and TMDB. Pick a door.
        </p>
      </section>

      <Marquee items={TICKER} />

      <section className="relative z-10 mx-auto grid max-w-5xl gap-5 px-4 py-16 sm:grid-cols-2 sm:px-8">
        {ROOMS.map((room, i) => (
          <RoomCard key={room.href} index={i} {...room} />
        ))}
      </section>

      <footer className="relative z-10 border-t border-line px-4 py-10 sm:px-8">
        <p className="microlabel">
          data · wikipedia rest api · deezer api · sleeper api · espn · tmdb · flagcdn
          — this product uses the TMDB API but is not endorsed or certified by TMDB
        </p>
      </footer>
    </main>
  );
}
