"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "framer-motion";
import CardFace, { type Game } from "./CardFace";

const FAN_STEP = 9; // degrees between fanned cards
const PAGE_THRESHOLD = 70; // px of horizontal travel to page the browser
const FLICK_VELOCITY = 480; // px/s — a fast flick pages even below the px threshold

type Mode = "browser" | "spread" | "coverflow" | "fan";

// circular signed distance of `pos` from a (possibly fractional) `center`,
// folded into the range [-n/2, n/2) so the deck wraps infinitely both ways.
function circularDelta(pos: number, center: number, n: number) {
  let d = pos - center;
  d = ((d % n) + n) % n; // 0 … n
  if (d > n / 2) d -= n; // -n/2 … n/2
  return d;
}

export default function Deck({ games }: { games: Game[] }) {
  const reduced = useReducedMotion() ?? false;
  const n = games.length;
  const [order, setOrder] = useState(() => games.map((_, i) => i));
  const [mode, setMode] = useState<Mode>("browser");
  const [selected, setSelected] = useState<number | null>(null);
  const [shuffling, setShuffling] = useState(false);
  // The zoom overlay is portalled to <body>: the page's `.page-enter` wrapper has
  // a transform, which would otherwise trap position:fixed inside the section.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const spring = reduced
    ? { duration: 0.15 }
    : { type: "spring" as const, stiffness: 200, damping: 26 };

  const frozen = selected !== null; // selecting freezes drift/auto motion

  // ── BROWSER paging: `active` is a position into `order` (0…n-1). ──────────────
  const [active, setActive] = useState(0);
  const stepBrowser = (dir: 1 | -1) =>
    setActive((a) => (((a + dir) % n) + n) % n);

  // ── COVERFLOW index: a continuous float; render by circular distance. ─────────
  const coverIndex = useMotionValue(0);
  const [coverFront, setCoverFront] = useState(0); // nearest integer card, for tap-select
  useEffect(() => {
    const unsub = coverIndex.on("change", (v) => {
      const idx = ((Math.round(v) % n) + n) % n;
      setCoverFront(idx);
    });
    return unsub;
  }, [coverIndex, n]);
  const stepCover = (dir: 1 | -1) => {
    coverIndex.set(coverIndex.get() + dir);
  };
  // gentle auto-drift in coverflow — user input overrides, freeze on select.
  useEffect(() => {
    if (mode !== "coverflow" || reduced || frozen) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      coverIndex.set(coverIndex.get() + dt * 0.12); // ~1 card / 8s
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, reduced, frozen, coverIndex]);

  // ── FAN focus: pointer X (0..1 across the stage) → focused card index, ────────
  // smoothed by a spring for buttery transitions.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fanPointer = useMotionValue((n - 1) / 2); // resting at centre card
  const fanFocus = useSpring(fanPointer, { stiffness: 220, damping: 26, mass: 0.4 });
  const [fanFocusInt, setFanFocusInt] = useState(Math.round((n - 1) / 2));
  useEffect(() => {
    const unsub = fanFocus.on("change", (v) =>
      setFanFocusInt(Math.max(0, Math.min(n - 1, Math.round(v))))
    );
    return unsub;
  }, [fanFocus, n]);
  // Sensitivity: tightened ~1.5× — a smaller pointer delta moves focus one card.
  // Default mapping would be one card per (width / n); we map to a virtual span of
  // n / 1.5 cards across the full width, so the same nudge pops the neighbour.
  const onFanPointerMove = (e: React.PointerEvent) => {
    if (reduced || mode !== "fan") return;
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const span = n / 1.5; // virtual range > n/… raises sensitivity ~1.5×
    const centre = (n - 1) / 2;
    fanPointer.set(centre + (t - 0.5) * span);
  };

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
      : mode === "spread"
      ? "every room, laid out — tap a card to draw it"
      : mode === "coverflow"
      ? "scroll, swipe or use ← → to glide · tap the front card to draw it"
      : reduced
      ? "tap a card to draw it"
      : "sweep the cursor left and right · tap a card to draw it";

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
        <DeckButton
          onClick={() => setMode((m) => (m === "fan" ? "browser" : "fan"))}
          active={mode === "fan"}
        >
          {mode === "fan" ? "▤ gather" : "◡ fan out"}
        </DeckButton>
        <DeckButton
          onClick={() => setMode((m) => (m === "coverflow" ? "browser" : "coverflow"))}
          active={mode === "coverflow"}
        >
          {mode === "coverflow" ? "▤ settle" : "◍ orbit"}
        </DeckButton>
        <DeckButton onClick={shuffle}>♠ shuffle</DeckButton>
      </div>

      {/* the deck stage + arrow rails (browser & coverflow page horizontally) */}
      <div className="deck-stagewrap">
        {(mode === "browser" || mode === "coverflow") && (
          <>
            <DeckArrow
              dir="prev"
              onClick={() => (mode === "browser" ? stepBrowser(-1) : stepCover(-1))}
            />
            <DeckArrow
              dir="next"
              onClick={() => (mode === "browser" ? stepBrowser(1) : stepCover(1))}
            />
          </>
        )}

        {mode === "spread" ? (
          <SpreadGrid games={games} order={order} reduced={reduced} onSelect={select} />
        ) : (
          <div
            ref={stageRef}
            className="deck-stage"
            style={{ perspective: 1600 }}
            onPointerMove={mode === "fan" ? onFanPointerMove : undefined}
          >
            {shuffling && !reduced ? (
              <ShuffleOverlay games={games} order={order} />
            ) : mode === "browser" ? (
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
            ) : mode === "coverflow" ? (
              <CoverflowStage
                games={games}
                order={order}
                n={n}
                coverIndex={coverIndex}
                coverFront={coverFront}
                reduced={reduced}
                spring={spring}
                onSelect={select}
              />
            ) : (
              <FanStage
                games={games}
                order={order}
                n={n}
                fanFocus={fanFocusInt}
                reduced={reduced}
                shuffling={shuffling}
                spring={spring}
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

// ── COVERFLOW: horizontal flow, centred card largest/opaque, depth falloff. ───
function CoverflowStage({
  games,
  order,
  n,
  coverIndex,
  coverFront,
  reduced,
  spring,
  onSelect,
}: {
  games: Game[];
  order: number[];
  n: number;
  coverIndex: MotionValue<number>;
  coverFront: number;
  reduced: boolean;
  spring: object;
  onSelect: (gi: number) => void;
}) {
  // wheel + horizontal scroll advance the continuous index.
  const onWheel = (e: React.WheelEvent) => {
    if (reduced) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    coverIndex.set(coverIndex.get() + d * 0.0035);
  };
  const dragStart = useRef(0);
  return (
    <motion.div
      className="deck-cover"
      onWheel={reduced ? undefined : onWheel}
      drag={reduced ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      dragSnapToOrigin
      onDragStart={() => (dragStart.current = coverIndex.get())}
      onDrag={(_, info) => {
        if (reduced) return;
        coverIndex.set(dragStart.current - info.offset.x * 0.012);
      }}
    >
      {order.map((gi, pos) => (
        <CoverflowCard
          key={games[gi].href}
          game={games[gi]}
          pos={pos}
          n={n}
          coverIndex={coverIndex}
          front={coverFront}
          reduced={reduced}
          spring={spring}
          onSelect={() => onSelect(gi)}
        />
      ))}
    </motion.div>
  );
}

function CoverflowCard({
  game,
  pos,
  n,
  coverIndex,
  front,
  reduced,
  spring,
  onSelect,
}: {
  game: Game;
  pos: number;
  n: number;
  coverIndex: MotionValue<number>;
  front: number;
  reduced: boolean;
  spring: object;
  onSelect: () => void;
}) {
  const isFront = pos === front;
  // spacing: spread cards across the stage width; clamp so edges stay visible.
  const SPACING = 132; // px per step away from centre
  const x = useTransform(coverIndex, (c) => {
    const d = circularDelta(pos, c, n);
    return d * SPACING;
  });
  const scale = useTransform(coverIndex, (c) => {
    const d = Math.abs(circularDelta(pos, c, n));
    return Math.max(0.5, 1.05 - d * 0.18);
  });
  const opacity = useTransform(coverIndex, (c) => {
    const d = Math.abs(circularDelta(pos, c, n));
    return Math.max(0, 1 - d * 0.34);
  });
  const z = useTransform(coverIndex, (c) => {
    const d = Math.abs(circularDelta(pos, c, n));
    return -d * 90;
  });
  const rotateY = useTransform(coverIndex, (c) => {
    const d = circularDelta(pos, c, n);
    return Math.max(-50, Math.min(50, -d * 18));
  });
  const zIndex = useTransform(coverIndex, (c) => {
    const d = Math.abs(circularDelta(pos, c, n));
    return Math.round(100 - d * 10);
  });

  if (reduced) {
    // static: lay cards in a simple row, front card centred (no live transforms).
    // State-driven (front index) so arrow steps re-render without a rAF loop.
    const d = circularDelta(pos, front, n);
    const ad = Math.abs(d);
    if (ad > 2) return null; // only render the near neighbourhood when static
    return (
      <button
        type="button"
        aria-label={`${game.name} — open`}
        onClick={onSelect}
        className="deck-slot deck-scene"
        style={{
          transform: `translateX(${d * 120}px) scale(${ad === 0 ? 1 : 0.78})`,
          opacity: ad === 0 ? 1 : 0.5,
          zIndex: 100 - ad * 10,
        }}
      >
        <CardFace game={game} side="front" />
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      aria-label={`${game.name} — ${isFront ? "open" : "glide here"}`}
      onClick={onSelect}
      className="deck-slot deck-scene"
      style={{ x, scale, opacity, z, rotateY, zIndex }}
      transition={spring}
    >
      <CardFace game={game} side="front" />
    </motion.button>
  );
}

// ── FAN: pointer-X focuses a card; wide spread; springy. ──────────────────────
function FanStage({
  games,
  order,
  n,
  fanFocus,
  reduced,
  shuffling,
  spring,
  onSelect,
}: {
  games: Game[];
  order: number[];
  n: number;
  fanFocus: number;
  reduced: boolean;
  shuffling: boolean;
  spring: object;
  onSelect: (gi: number) => void;
}) {
  return (
    <>
      {order.map((gi, pos) => (
        <FanCard
          key={games[gi].href}
          game={games[gi]}
          pos={pos}
          n={n}
          focused={pos === fanFocus}
          reduced={reduced}
          shuffling={shuffling}
          spring={spring}
          onSelect={() => onSelect(gi)}
        />
      ))}
    </>
  );
}

function FanCard({
  game,
  pos,
  n,
  focused,
  reduced,
  shuffling,
  spring,
  onSelect,
}: {
  game: Game;
  pos: number;
  n: number;
  focused: boolean;
  reduced: boolean;
  shuffling: boolean;
  spring: object;
  onSelect: () => void;
}) {
  const mid = (n - 1) / 2;
  const off = pos - mid; // -mid … +mid
  const angle = off * FAN_STEP;
  // WIDE spread: push cards across nearly the whole container. Clamp via the
  // CSS var --fan-w so edge cards stay on-screen at every breakpoint.
  const x = `calc(${off} * var(--fan-x))`;
  const lift = off * off * -2; // arc: edge cards sit a touch lower
  const raised = focused && !reduced;
  return (
    <motion.button
      type="button"
      aria-label={`${game.name} — open`}
      onClick={onSelect}
      initial={false}
      animate={{
        x,
        y: raised ? lift - 30 : lift,
        rotate: reduced ? angle : raised ? 0 : angle,
        scale: raised ? 1.08 : 1,
        zIndex: raised ? 60 : pos,
      }}
      transition={shuffling ? { duration: 0.4 } : spring}
      style={{ transformOrigin: "50% 150%" }}
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
