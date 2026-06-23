import Marquee from "@/components/Marquee";
import CardDeck from "@/components/CardDeck";
import type { Game } from "@/components/GameCard";
import { isDbConfigured } from "@/lib/db";

const TICKER = [
  "forged nightly from Wikipedia · Deezer · Sleeper · ESPN · TMDB",
  "the rite of spring caused a riot in 1913",
  "saturn has the most confirmed moons",
  "canberra, not sydney",
  "9.58 seconds — usain bolt, 2009",
  "rosebud was a sled",
  "south africa has three capitals",
  "the eiffel tower grows 15 cm taller in summer",
  "♦ your card has been dealt",
];

// One card per game. Suit = category; each carries exactly one Secret Order
// character (canon owned by 2.11, GAMES.md). The Mystery is the feature card.
const GAMES: Game[] = [
  {
    href: "/mystery",
    name: "The Mystery",
    accent: "history",
    character: "the Order",
    emblem: "◉",
    feature: true,
    blurb:
      "A new case every night. Read the dossiers, follow the clues, and name the culprit before the candle gutters out.",
  },
  {
    href: "/board",
    name: "The Board",
    accent: "history",
    character: "the Host",
    emblem: "▦",
    blurb:
      "Five categories, five values, one daily double. The same board for everyone, every day.",
  },
  {
    href: "/clock",
    name: "The Clock",
    accent: "music",
    character: "the Clockkeeper",
    emblem: "⧗",
    blurb:
      "When did it happen? Drag the year — closer guesses, bigger points. Five rounds against the century.",
  },
  {
    href: "/wedges",
    name: "The Wedges",
    accent: "sports",
    character: "the Ghost",
    emblem: "❖",
    blurb:
      "Six wedges, twenty questions. Fill the ring before the deck runs out — quickfire across every category.",
  },
  {
    href: "/streak",
    name: "The Streak",
    accent: "screen",
    character: "the Witch",
    emblem: "✺",
    blurb:
      "Higher or lower? Populations, box offices, fan counts. One wrong call ends the run.",
  },
  {
    href: "/map",
    name: "The Map",
    accent: "geography",
    character: "the Cartographer",
    emblem: "❂",
    blurb:
      "Drop a pin where it happened. Scored by the kilometer — no tile servers, no mercy.",
  },
  {
    href: "/daily",
    name: "The Daily",
    accent: "wildcard",
    character: "the Adventurer",
    emblem: "⚜",
    blurb:
      "One round from every room, once a day, the same gauntlet for everyone. Share your line of squares.",
  },
  {
    href: "/thread",
    name: "The Thread",
    accent: "history",
    character: "the Weaver",
    emblem: "❧",
    blurb:
      "Follow the chain of clues. Each answer links to the next — unravel the thread before it tangles.",
  },
  {
    href: "/seance",
    name: "The Séance",
    accent: "wildcard",
    character: "the Medium",
    emblem: "☾",
    blurb:
      "Who or what am I? Each clue costs a point. The earliest correct answer earns the most.",
  },
  {
    href: "/ladder",
    name: "The Ladder",
    accent: "music",
    character: "the Trickster",
    emblem: "◬",
    blurb:
      "Pick the closest match. Hints reveal shared attributes — category, region, magnitude. Climb the ladder.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="glow" style={{ background: "#6e1f2b" }} aria-hidden />

      {/* The threshold — invitation, not nightlife */}
      <section className="relative z-10 flex min-h-[82vh] flex-col justify-end px-4 pb-10 pt-12 sm:px-8">
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/40 to-transparent" aria-hidden />

        <div className="flex items-center justify-between">
          <span className="microlabel">the secret order · by invitation</span>
          <span className="microlabel" style={{ color: "#a87a2e99" }}>
            {isDbConfigured() ? "♦ live bank" : "♦ nightly deck"}
          </span>
        </div>

        <div className="mt-auto">
          {/* Order seal — the flaming spade & all-seeing eye */}
          <img
            src="/logo-256.png"
            alt="The Parlor — a secret order"
            width={120}
            height={132}
            className="eye-glow mb-4 h-28 w-auto drop-shadow-[0_6px_30px_rgba(110,31,43,0.5)] sm:h-32"
          />
          <p className="microlabel mb-3 tracking-[0.3em] text-brass">
            ✦ &nbsp; a secret order of the curious &nbsp; ✦
          </p>
          <h1
            className="display text-[clamp(4.5rem,20vw,15rem)] leading-none"
            style={{
              background:
                "linear-gradient(135deg, #c9a24a 0%, #f0dca0 48%, #a87a2e 78%, #6e1f2b 120%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Parlor
          </h1>
        </div>

        <p className="mt-4 max-w-lg text-sm text-muted sm:text-base">
          Ten rooms behind one velvet door. A question bank forged nightly, a new
          mystery every dusk. Draw a card — the house always keeps a secret.
        </p>

        <div className="mt-6 flex gap-4 text-lg text-brass opacity-30" aria-hidden>
          <span>♠</span><span>♦</span><span>☾</span><span>♣</span><span>♥</span><span>✦</span>
        </div>
      </section>

      <Marquee items={TICKER} />

      <CardDeck games={GAMES} />

      <footer className="relative z-10 border-t border-line px-4 py-10 sm:px-8">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-brass opacity-40">✦</span>
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-brass opacity-40">✦</span>
        </div>
        <p className="microlabel">
          data · wikipedia rest api · deezer api · sleeper api · espn · tmdb — this
          product uses the TMDB API but is not endorsed or certified by TMDB
        </p>
      </footer>
    </main>
  );
}
