"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CATEGORY_HEX } from "@/lib/types";
import GameCard, { type Game } from "./GameCard";

// The home as a deck of cards. One game is the feature (the Mystery showpiece);
// the rest deal into a grid you can shuffle. Card-trick vocabulary: deal-in
// (stagger), flip (GameCard hover/focus), shuffle (layout reorder).
export default function CardDeck({ games }: { games: Game[] }) {
  const reduced = useReducedMotion() ?? false;
  const feature = games.find((g) => g.feature);
  const deck = games.filter((g) => !g.feature);

  // identity order; shuffle permutes it. Math.random lives in a click handler
  // only (never SSR render) — safe per CLAUDE.md / lib/rng SSR rules.
  const [order, setOrder] = useState(() => deck.map((_, i) => i));

  const shuffle = () =>
    setOrder((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduced ? 0 : 0.06, delayChildren: 0.08 },
    },
  };

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-8">
      <div className="deco-rule mb-8">
        <span className="display text-lg tracking-[0.2em] text-gold">
          The Deck
        </span>
      </div>

      {feature && <FeatureCard game={feature} reduced={reduced} />}

      <div className="mb-6 mt-12 flex items-center justify-between">
        <span className="microlabel">choose your card</span>
        <button
          type="button"
          onClick={shuffle}
          className="microlabel rounded-full border border-line px-4 py-2 text-gold transition hover:border-gold/60 hover:text-goldlite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          ♠ shuffle the deck
        </button>
      </div>

      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4"
      >
        {order.map((idx) => (
          <GameCard key={deck[idx].href} game={deck[idx]} />
        ))}
      </motion.ul>
    </section>
  );
}

// The Mystery showpiece — top billing, landscape, the all-seeing eye motif.
function FeatureCard({ game, reduced }: { game: Game; reduced: boolean }) {
  const hex = CATEGORY_HEX[game.accent];
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={game.href}
        aria-label={`Enter ${game.name}`}
        className="candle-pool gilt-frame group relative flex flex-col items-center gap-5 overflow-hidden rounded-2xl p-8 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:flex-row sm:gap-8 sm:p-10 sm:text-left"
      >
        <span
          className="eye-glow gilt relative z-10 text-7xl leading-none sm:text-8xl"
          aria-hidden
        >
          {game.emblem}
        </span>
        <div className="relative z-10">
          <span className="microlabel" style={{ color: hex }}>
            ♦ {game.character} · tonight's case
          </span>
          <h2 className="display mt-2 text-5xl sm:text-6xl">{game.name}</h2>
          <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
            {game.blurb}
          </p>
          <span className="microlabel mt-4 inline-block text-gold transition group-hover:translate-x-1">
            begin the investigation →
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
