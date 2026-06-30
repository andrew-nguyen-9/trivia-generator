import Link from "next/link";
import Marquee from "@/components/Marquee";
import Deck from "@/components/Deck";
import type { Game } from "@/components/CardFace";
import { CATEGORY_HEX } from "@/lib/types";
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
    name: "Sanctum Mysterii",
    accent: "history",
    character: "the Order",
    emblem: "◉", // the all-seeing eye
    rank: 1, // the Ace
    blurb:
      "A new case every night. Read the dossiers, follow the clues, and name the culprit before the candle gutters out.",
  },
  {
    href: "/board",
    name: "Codex",
    accent: "history",
    character: "the Host",
    emblem: "⌘", // the open codex / page of categories
    rank: 2,
    blurb:
      "Five categories, five values, one daily double. The same board for everyone, every day.",
  },
  {
    href: "/clock",
    name: "Chronos",
    accent: "music",
    character: "the Clockkeeper",
    emblem: "⧗", // a clock face
    rank: 3,
    blurb:
      "When did it happen? Drag the year — closer guesses, bigger points. Five rounds against the century.",
  },
  {
    href: "/wedges",
    name: "Fractures",
    accent: "sports",
    character: "the Ghost",
    emblem: "⬡", // the shattered mirror's shard
    rank: 4,
    blurb:
      "Six wedges, twenty questions. Fill the ring before the deck runs out — quickfire across every category.",
  },
  {
    href: "/streak",
    name: "Ignite",
    accent: "screen",
    character: "the Witch",
    emblem: "✦", // the witch's kindling flame
    rank: 5,
    blurb:
      "Higher or lower? Populations, box offices, fan counts. One wrong call ends the run.",
  },
  {
    href: "/map",
    name: "Atlas Obscura",
    accent: "geography",
    character: "the Cartographer",
    emblem: "⌖", // drop a pin
    rank: 6,
    blurb:
      "Drop a pin where it happened. Scored by the kilometer — no tile servers, no mercy.",
  },
  {
    href: "/gauntlet",
    name: "The Gauntlet",
    accent: "wildcard",
    character: "the Adventurer",
    emblem: "⧈", // the day's run
    rank: 7,
    blurb:
      "One round from every room, once a day, the same gauntlet for everyone. Share your line of squares.",
  },
  {
    href: "/thread",
    name: "Thread of Fate",
    accent: "history",
    character: "the Weaver",
    emblem: "⌇", // a stitch of thread
    rank: 8,
    blurb:
      "Follow the chain of clues. Each answer links to the next — unravel the thread before it tangles.",
  },
  {
    href: "/seance",
    name: "The Séance",
    accent: "wildcard",
    character: "the Medium",
    emblem: "☍", // the spirit's moon
    rank: 9,
    blurb:
      "Who or what am I? Each clue costs a point. The earliest correct answer earns the most.",
  },
  {
    href: "/ladder",
    name: "Climb of the Initiate",
    accent: "music",
    character: "the Trickster",
    emblem: "☰", // the rungs
    rank: 10,
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
            src="/logo-256.png?v=2"
            alt="The Parlor — a secret order"
            width={120}
            height={132}
            className="eye-glow mb-4 h-28 w-auto drop-shadow-[0_6px_30px_rgba(110,31,43,0.5)] sm:h-32"
          />
          <p className="microlabel mb-3 tracking-[0.3em] text-brass">
            ✦ &nbsp; a secret order of the curious &nbsp; ✦
          </p>
          <h1 className="gilt display text-[clamp(4.5rem,20vw,15rem)] leading-[0.86] tracking-[0.01em]">
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

      <Deck games={GAMES} />

      {/* The ledger — every room at a glance, server-rendered from GAMES */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="deco-rule mb-8">
          <span className="gilt display text-lg tracking-[0.2em]">The Rooms</span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => (
            <li key={game.href} className={game.href === "/mystery" ? "lg:col-span-3" : undefined}>
              <Link
                href={game.href}
                className="gilt-frame group flex h-full gap-4 rounded-xl bg-surface/40 p-5 transition hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <span
                  aria-hidden
                  className="display mt-0.5 shrink-0 text-3xl leading-none"
                  style={{ color: CATEGORY_HEX[game.accent] }}
                >
                  {game.emblem}
                </span>
                <div className="min-w-0">
                  <span
                    className="microlabel block"
                    style={{ color: CATEGORY_HEX[game.accent] }}
                  >
                    {game.character}
                  </span>
                  <h3 className="gilt display mt-1 text-lg leading-tight tracking-[0.04em]">
                    {game.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {game.blurb}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

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
