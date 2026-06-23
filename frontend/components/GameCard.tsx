"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { CATEGORY_HEX, type Category } from "@/lib/types";

// One bespoke card per game: a suit (its category), a Secret Order character, and
// an engraved emblem. ponytail: face art is composed from the seal's motif
// vocabulary in CSS — bespoke per-card illustration + Unsplash treatment is a
// later polish (DESIGN_SYSTEM §imagery), not needed for the deck foundation.
export type Game = {
  href: string;
  name: string;
  accent: Category;
  character: string;
  emblem: string;
  blurb: string;
  feature?: boolean;
};

// Category → card suit, matching RoomShell so a game reads the same everywhere.
const SUIT: Record<Category, string> = {
  history: "♦",
  music: "♥",
  sports: "♣",
  screen: "♠",
  geography: "✦",
  wildcard: "✧",
};

const cardVariants = (reduced: boolean): Variants => ({
  // deal-in: cards fly up from a stacked, slightly-rotated origin into the grid.
  hidden: reduced
    ? { opacity: 0 }
    : { opacity: 0, y: 44, scale: 0.92, rotateZ: -5 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateZ: 0,
    transition: reduced
      ? { duration: 0.2 }
      : { type: "spring", stiffness: 130, damping: 17 },
  },
});

export default function GameCard({ game }: { game: Game }) {
  const reduced = useReducedMotion() ?? false;
  const hex = CATEGORY_HEX[game.accent];
  const suit = SUIT[game.accent];

  const Front = (
    <>
      <div className="flex items-start justify-between">
        <span className="microlabel" style={{ color: hex }}>
          {suit} {game.character}
        </span>
        <span className="text-sm opacity-40" style={{ color: hex }} aria-hidden>
          {suit}
        </span>
      </div>
      <div className="my-auto flex flex-col items-center text-center">
        <span className="deck-emblem gilt" aria-hidden>
          {game.emblem}
        </span>
        <h3
          className="display mt-3 text-2xl sm:text-3xl"
          style={{ color: "var(--ink, #f0e6cf)" }}
        >
          {game.name}
        </h3>
      </div>
      <span className="microlabel mt-auto self-end opacity-40" aria-hidden>
        ✦
      </span>
    </>
  );

  // Reduced-motion: a flat, static card — emblem + name + blurb visible at once,
  // no flip, no perpetual motion. (2.14 fallback.)
  if (reduced) {
    return (
      <motion.li variants={cardVariants(true)} layout className="list-none">
        <Link
          href={game.href}
          aria-label={`Enter ${game.name}`}
          className="deck-face !static block h-full gilt-frame transition hover:border-[--accent]"
          style={{ ["--accent" as string]: `${hex}66` }}
        >
          {Front}
          <p className="mt-3 text-xs leading-relaxed text-muted">{game.blurb}</p>
          <span className="microlabel mt-2" style={{ color: hex }}>
            enter →
          </span>
        </Link>
      </motion.li>
    );
  }

  return (
    <motion.li
      variants={cardVariants(false)}
      layout
      whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.2 } }}
      className="deck-scene list-none rounded-[0.9rem]"
    >
      <Link
        href={game.href}
        aria-label={`Enter ${game.name}`}
        className="deck-card block rounded-[0.9rem] outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <div className="deck-face">{Front}</div>
        <div
          className="deck-face deck-back"
          style={{ borderColor: `${hex}55` }}
        >
          <span className="microlabel" style={{ color: hex }}>
            {suit} {game.name}
          </span>
          <p className="my-auto text-sm leading-relaxed text-ink/90">
            {game.blurb}
          </p>
          <span className="microlabel self-end" style={{ color: hex }}>
            enter →
          </span>
        </div>
      </Link>
    </motion.li>
  );
}
