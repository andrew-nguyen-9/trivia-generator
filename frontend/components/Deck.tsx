"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import CardFace, { type Game } from "./CardFace";

const PAGE_THRESHOLD = 70; // px of horizontal travel to page the browser
const FLICK_VELOCITY = 480; // px/s — a fast flick pages even below the px threshold

// ponytail: Fan Out + Orbit modes removed (wishlist 4) — Lay Out (spread) is
// now the only/default layout, Browse is the only paged mode.
type Mode = "browser" | "spread";

export default function Deck({ games }: { games: Game[] }) {
  const reduced = useReducedMotion() ?? false;
  const n = games.length;
  const [order, setOrder] = useState(() => games.map((_, i) => i));
  const [mode, setMode] = useState<Mode>("spread"); // Lay Out is the default view
  const [selected, setSelected] = useState<number | null>(null);
  const [shuffling, setShuffling] = useState(false);
  // The zoom overlay is portalled to <body>: the page's `.page-enter` wrapper has
  // a transform, which would otherwise trap position:fixed inside the section.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const spring = reduced
    ? { duration: 0.15 }
    : { type: "spring" as const, stiffness: 200, damping: 26 };

  // ── BROWSER paging: `active` is a position into `order` (0…n-1). ──────────────
  const [active, setActive] = useState(0);
  const stepBrowser = (dir: 1 | -1) =>
    setActive((a) => (((a + dir) % n) + n) % n);

  // ── per-card transforms ───────────────────────────────────────────────────────
  const reorderRandom = () =>
    setOrder((p) => {
      const next = [...p];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });

  // SHUFFLE — bridge/riffle. Reduced-motion: instant reorder + restack.
  const shuffle = () => {
    if (shuffling) return;
    setSelected(null);
    if (reduced) {
      reorderRandom();
      setMode("browser");
      setActive(0);
      return;
    }
    setMode("browser");
    setShuffling(true);
    window.setTimeout(() => reorderRandom(), 520);
    window.setTimeout(() => {
      setShuffling(false);
      setActive(0);
    }, 1000);
  };

  const microlabel =
    mode === "browser"
      ? "swipe or use ← → to browse · tap the centre card to draw it"
      : "every room, laid out — tap a card to draw it";

  const select = (gi: number) => setSelected(gi);

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-8">
      <div className="deco-rule mb-6">
        <span className="gilt display text-lg tracking-[0.2em]">The Deck</span>
      </div>

      {/* controls */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <DeckButton
          onClick={() => setMode((m) => (m === "spread" ? "browser" : "spread"))}
          active={mode === "spread"}
        >
          {mode === "spread" ? "▤ gather deck" : "▦ lay out"}
        </DeckButton>
        <DeckButton onClick={() => setMode("browser")} active={mode === "browser"}>
          ▤ browse
        </DeckButton>
        <DeckButton onClick={shuffle}>♠ shuffle</DeckButton>
      </div>

      {/* the deck stage + arrow rails (browser pages horizontally) */}
      <div className="deck-stagewrap">
        {mode === "browser" && (
          <>
            <DeckArrow dir="prev" onClick={() => stepBrowser(-1)} />
            <DeckArrow dir="next" onClick={() => stepBrowser(1)} />
          </>
        )}

        {mode === "spread" ? (
          <SpreadGrid games={games} order={order} reduced={reduced} onSelect={select} />
        ) : (
          <div className="deck-stage" style={{ perspective: 1600 }}>
            {shuffling && !reduced ? (
              <ShuffleOverlay games={games} order={order} />
            ) : (
              <BrowserStage
                games={games}
                order={order}
                n={n}
                active={active}
                reduced={reduced}
                shuffling={shuffling}
                spring={spring}
                onStep={stepBrowser}
                onSelect={select}
              />
            )}
          </div>
        )}
      </div>

      <p className="microlabel mt-6 text-center opacity-60">{microlabel}</p>

      {/* zoomed selection — portalled to <body> so position:fixed pins to the
          viewport (the page's transformed `.page-enter` wrapper would trap it) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selected !== null && (
              <ZoomOverlay
                game={games[selected]}
                reduced={reduced}
                spring={spring}
                onClose={() => setSelected(null)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}

// ── BROWSER: single-card horizontal pager. Drag/flick L→next, R→prev. ─────────
function BrowserStage({
  games,
  order,
  n,
  active,
  reduced,
  shuffling,
  spring,
  onStep,
  onSelect,
}: {
  games: Game[];
  order: number[];
  n: number;
  active: number;
  reduced: boolean;
  shuffling: boolean;
  spring: object;
  onStep: (d: 1 | -1) => void;
  onSelect: (gi: number) => void;
}) {
  // render the active card plus its two neighbours for a peeked deck feel.
  const slots = [-1, 0, 1].map((rel) => {
    const pos = (((active + rel) % n) + n) % n;
    return { rel, gi: order[pos] };
  });
  const SPREAD = 150; // px the neighbour cards peek out to the side

  return (
    <>
      {slots.map(({ rel, gi }) => {
        const game = games[gi];
        const isActive = rel === 0;
        return (
          <BrowserCard
            key={game.href}
            game={game}
            rel={rel}
            spread={SPREAD}
            isActive={isActive}
            reduced={reduced}
            shuffling={shuffling}
            spring={spring}
            onStep={onStep}
            onSelect={() => onSelect(gi)}
          />
        );
      })}
    </>
  );
}

function BrowserCard({
  game,
  rel,
  spread,
  isActive,
  reduced,
  shuffling,
  spring,
  onStep,
  onSelect,
}: {
  game: Game;
  rel: number;
  spread: number;
  isActive: boolean;
  reduced: boolean;
  shuffling: boolean;
  spring: object;
  onStep: (d: 1 | -1) => void;
  onSelect: () => void;
}) {
  const dragX = useMotionValue(0);
  const baseX = rel * spread;
  const scale = isActive ? 1 : 0.82;
  const opacity = isActive ? 1 : 0.4;
  const zIndex = isActive ? 30 : 10;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;
    if (dx <= -PAGE_THRESHOLD || vx <= -FLICK_VELOCITY) {
      onStep(1); // swipe LEFT → next
    } else if (dx >= PAGE_THRESHOLD || vx >= FLICK_VELOCITY) {
      onStep(-1); // swipe RIGHT → previous
    }
    dragX.set(0);
  };

  return (
    <motion.button
      type="button"
      aria-label={`${game.name} — ${isActive ? "open" : "bring to front"}`}
      aria-hidden={!isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => {
        if (isActive) onSelect();
        else onStep(rel > 0 ? 1 : -1);
      }}
      initial={false}
      animate={{ x: baseX, scale, opacity, zIndex }}
      transition={shuffling ? { duration: 0.4 } : spring}
      drag={isActive && !reduced && !shuffling ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.5}
      dragConstraints={{ left: 0, right: 0 }}
      style={{ x: isActive && !reduced ? dragX : undefined, zIndex }}
      onDragEnd={onDragEnd}
      className="deck-slot deck-scene"
    >
      <CardFace game={game} side="front" />
    </motion.button>
  );
}

// ── SPREAD: all 10 fronts in a responsive grid; each opens its zoom. ──────────
function SpreadGrid({
  games,
  order,
  reduced,
  onSelect,
}: {
  games: Game[];
  order: number[];
  reduced: boolean;
  onSelect: (gi: number) => void;
}) {
  return (
    <div className="deck-spread">
      {order.map((gi, i) => {
        const game = games[gi];
        return (
          <motion.button
            key={game.href}
            type="button"
            aria-label={`${game.name} — open`}
            onClick={() => onSelect(gi)}
            className="deck-spread-cell deck-scene"
            initial={reduced ? false : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduced ? { duration: 0.12 } : { delay: Math.min(i, 10) * 0.03 }}
            whileHover={reduced ? undefined : { y: -8, scale: 1.04 }}
          >
            <CardFace game={game} side="front" />
          </motion.button>
        );
      })}
    </div>
  );
}

// ── SHUFFLE: bridge / riffle. Split the stack L/R, riffle, snap back. ─────────
function ShuffleOverlay({ games, order }: { games: Game[]; order: number[] }) {
  return (
    <>
      {order.map((gi, pos) => {
        const side = pos % 2 === 0 ? -1 : 1;
        const game = games[gi];
        return (
          <motion.div
            key={game.href}
            className="deck-slot deck-scene"
            style={{ zIndex: order.length - pos }}
            initial={{ x: 0, y: 0, rotate: 0 }}
            animate={{
              x: [0, side * 140, side * 80, 0],
              y: [0, -12, 8, 0],
              rotate: [0, side * 8, side * -3, 0],
              rotateY: [0, 180, 180, 0],
            }}
            transition={{
              duration: 0.95,
              times: [0, 0.35, 0.7, 1],
              delay: Math.min(pos, 9) * 0.025,
              ease: "easeInOut",
            }}
          >
            <div className="deck-flip-inner" style={{ transform: "rotateY(0deg)" }}>
              <CardFace game={game} side="back" />
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

// ── ZOOM overlay (dialog) ─────────────────────────────────────────────────────
function ZoomOverlay({
  game,
  reduced,
  spring,
  onClose,
}: {
  game: Game;
  reduced: boolean;
  spring: object;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="deck-zoom-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${game.name} — drawn`}
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
          <CardFace game={game} side="front" zoomed />
        </div>
        <div className="deck-zoom-actions">
          <Link href={game.href} className="deck-play-btn" autoFocus>
            ▶ Play {game.name}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="deck-close-btn microlabel"
            aria-label="Close"
          >
            ✕ close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeckArrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous card" : "Next card"}
      className={`deck-arrow ${dir === "prev" ? "deck-arrow-prev" : "deck-arrow-next"}`}
    >
      {dir === "prev" ? "←" : "→"}
    </button>
  );
}

function DeckButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`microlabel rounded-full border px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
        active
          ? "border-gold/70 bg-gold/10 text-goldlite"
          : "border-line text-gold hover:border-gold/60 hover:text-goldlite"
      }`}
    >
      {children}
    </button>
  );
}
