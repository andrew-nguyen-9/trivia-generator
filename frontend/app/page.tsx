import Marquee from "@/components/Marquee";
import RoomCard from "@/components/RoomCard";
import { isSupabaseConfigured } from "@/lib/supabase";

const TICKER = [
  "forged nightly from Wikipedia · Deezer · Sleeper · ESPN · TMDB",
  "the rite of spring caused a riot in 1913",
  "saturn has the most confirmed moons",
  "canberra, not sydney",
  "9.58 seconds — usain bolt, 2009",
  "rosebud was a sled",
  "south africa has three capitals",
];

const ROOMS = [
  {
    href: "/board",
    name: "The Board",
    accent: "history" as const,
    blurb:
      "Five categories, five values, one daily double. The classic answer-and-question board — same board for everyone, every day.",
  },
  {
    href: "/clock",
    name: "The Clock",
    accent: "music" as const,
    blurb:
      "When did it happen? Drag the year. Closer guesses, bigger points. Five rounds against the century.",
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
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="glow" style={{ background: "#b07aff" }} aria-hidden />

      <section className="relative z-10 flex min-h-[78vh] flex-col justify-end px-4 pb-10 pt-10 sm:px-8">
        <div className="flex items-center justify-between">
          <span className="microlabel">an after-dark house of trivia games</span>
          <span className="microlabel">
            {isSupabaseConfigured() ? "live bank" : "house deck"}
          </span>
        </div>
        <h1 className="display mt-auto text-[clamp(4rem,18vw,14rem)]">Parlor</h1>
        <p className="max-w-xl text-sm text-muted sm:text-base">
          Four rooms. One question bank, forged nightly from Wikipedia, Deezer,
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
          data · wikipedia rest api · deezer api · sleeper api · espn · tmdb — this
          product uses the TMDB API but is not endorsed or certified by TMDB
        </p>
      </footer>
    </main>
  );
}
