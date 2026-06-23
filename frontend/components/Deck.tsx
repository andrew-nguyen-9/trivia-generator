"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import CardFace, { type Game } from "./CardFace";

const FAN_STEP = 7; // degrees between fanned cards

export default function Deck({ games }: { games: Game[] }) {
  const reduced = useReducedMotion() ?? false;
  const n = games.length;
  const [order, setOrder] = useState(() => games.map((_, i) => i));
  const [mode, setMode] = useState<"deck" | "fan">("deck");
  const [selected, setSelected] = useState<number | null>(null);
  // The zoom overlay is portalled to <body>: the page's `.page-enter` wrapper has
  // a transform, which would otherwise trap position:fixed inside the section.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const spring = reduced
    ? { duration: 0.15 }
    : { type: "spring" as const, stiffness: 160, damping: 20 };

  // Move the top card to the bottom — the carousel cycle.
  const cycle = () => setOrder((p) => [...p.slice(1), p[0]]);
  const shuffle = () =>
    setOrder((p) => {
      const next = [...p];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });

  // Per-card transform, by its position in the current order.
  const transformFor = (pos: number) => {
    if (mode === "fan") {
      const angle = (pos - (n - 1) / 2) * FAN_STEP;
      return { x: 0, y: 0, rotate: angle, scale: 1, zIndex: pos };
    }
    return {
      x: pos * 1.4,
      y: pos * 1.2,
      rotate: reduced ? 0 : (pos % 2 ? 1 : -1) * Math.min(pos, 4) * 0.5,
      scale: 1 - Math.min(pos, 6) * 0.012,
      zIndex: n - pos,
    };
  };

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-8">
      <div className="deco-rule mb-6">
        <span className="gilt display text-lg tracking-[0.2em]">The Deck</span>
      </div>

      {/* controls */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <DeckButton onClick={mode === "deck" ? cycle : () => setMode("deck")}>
          {mode === "deck" ? "▸ next card" : "⊟ gather"}
        </DeckButton>
        <DeckButton onClick={() => setMode((m) => (m === "deck" ? "fan" : "deck"))}>
          {mode === "deck" ? "◡ fan out" : "▤ stack"}
        </DeckButton>
        <DeckButton onClick={shuffle}>♠ shuffle</DeckButton>
      </div>

      {/* the deck stage */}
      <div className="deck-stage" style={{ perspective: 1600 }}>
        {order.map((gi, pos) => {
          const game = games[gi];
          const t = transformFor(pos);
          const isTop = pos === 0;
          const showFront = mode === "fan" || isTop;
          return (
            <motion.button
              key={game.href}
              type="button"
              aria-label={`${game.name} — ${showFront ? "open" : "reveal"}`}
              onClick={() => (mode === "fan" || isTop ? setSelected(gi) : cycle())}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.9 }}
              animate={{ opacity: 1, ...t }}
              transition={{ ...spring, delay: reduced ? 0 : Math.min(pos, 8) * 0.04 }}
              whileHover={mode === "fan" && !reduced ? { y: -26, scale: 1.05, zIndex: 50 } : undefined}
              className="deck-slot deck-scene"
              style={{ transformOrigin: mode === "fan" ? "50% 145%" : "50% 50%" }}
            >
              <CardFace game={game} side={showFront ? "front" : "back"} />
            </motion.button>
          );
        })}
      </div>

      <p className="microlabel mt-6 text-center opacity-60">
        {mode === "deck"
          ? "tap the top card to draw it · fan out to choose"
          : "pick a card"}
      </p>

      {/* zoomed selection — portalled to <body> so position:fixed pins to the
          viewport (the page's transformed `.page-enter` wrapper would trap it) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selected !== null && (
              <motion.div
                className="deck-zoom-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="deck-zoom-wrap"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 30 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="deck-zoom-card deck-scene">
                <CardFace game={games[selected]} side="front" zoomed />
              </div>
              <div className="flex items-center justify-center gap-4">
                <Link href={games[selected].href} className="deck-enter-btn">
                  enter {games[selected].name} →
                </Link>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="microlabel rounded-full border border-line px-4 py-2 text-muted transition hover:text-ink"
                >
                  ✕ close
                </button>
              </div>
            </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}

function DeckButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="microlabel rounded-full border border-line px-4 py-2 text-gold transition hover:border-gold/60 hover:text-goldlite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      {children}
    </button>
  );
}
