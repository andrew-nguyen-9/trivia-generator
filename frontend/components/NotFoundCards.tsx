"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GAME_ROOMS } from "@/lib/rooms";
import { CATEGORY_HEX, type Category } from "@/lib/types";

const SUIT: Record<Category, string> = {
  history: "♦",
  music: "♥",
  sports: "♣",
  screen: "♠",
  geography: "✦",
  wildcard: "✧",
};

// One floating card per game — suit + rank, in the deck's gold-on-oxblood hand.
const CARDS = GAME_ROOMS.slice(0, 12).map((r, i) => ({
  suit: r.accent,
  rank: i + 1 === 1 ? "A" : String(i + 1),
  hex: CATEGORY_HEX[r.accent],
}));

const CARD_W = 46;
const CARD_H = 64;

type Pt = { x: number; y: number };
type Mode = "float" | "spade" | "constellation";

// --- magical shapes, as normalized point sets in [-1, 1] -------------------

/** Spade silhouette: a vertically-flipped heart curve + a short stem. */
function spadePoints(n: number): Pt[] {
  const pts: Pt[] = [];
  const outline = Math.max(1, n - 3);
  for (let i = 0; i < outline; i++) {
    const t = (i / outline) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy =
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x: hx / 17, y: -hy / 17 }); // flip y → spade
  }
  for (let i = 0; i < n - outline; i++) {
    pts.push({ x: 0, y: 0.55 + (i / Math.max(1, n - outline)) * 0.4 }); // stem
  }
  return pts;
}

/** A fixed, slightly-asymmetric star scatter that reads as a constellation. */
const CONSTELLATION: Pt[] = [
  { x: -0.8, y: -0.5 }, { x: -0.45, y: -0.7 }, { x: -0.1, y: -0.45 },
  { x: 0.25, y: -0.65 }, { x: 0.6, y: -0.35 }, { x: 0.85, y: -0.6 },
  { x: 0.55, y: 0.05 }, { x: 0.2, y: 0.25 }, { x: -0.15, y: 0.15 },
  { x: -0.5, y: 0.4 }, { x: -0.8, y: 0.15 }, { x: 0.05, y: 0.6 },
];

function shapePoints(mode: Mode, n: number): Pt[] {
  if (mode === "spade") return spadePoints(n);
  return CONSTELLATION.slice(0, n);
}

/** Reflect a moving card off an axis-aligned obstacle, smallest-penetration. */
function bounceObstacle(p: Pt, v: Pt, r: DOMRect, host: DOMRect) {
  const x = host.left + p.x;
  const y = host.top + p.y;
  const pad = 6;
  if (
    x + CARD_W < r.left - pad || x > r.right + pad ||
    y + CARD_H < r.top - pad || y > r.bottom + pad
  )
    return;
  // overlap depths on each side
  const left = r.left - pad - (x + CARD_W);
  const right = x - (r.right + pad);
  const top = r.top - pad - (y + CARD_H);
  const bottom = y - (r.bottom + pad);
  const dx = Math.abs(left) < Math.abs(right) ? left : right;
  const dy = Math.abs(top) < Math.abs(bottom) ? top : bottom;
  if (Math.abs(dx) < Math.abs(dy)) {
    p.x += dx;
    v.x = -v.x;
  } else {
    p.y += dy;
    v.y = -v.y;
  }
}

export default function NotFoundCards() {
  const hostRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const pos = useRef<Pt[]>([]);
  const vel = useRef<Pt[]>([]);
  const mode = useRef<Mode>("float");
  const target = useRef<Pt[]>([]);
  const [reduced, setReduced] = useState(false);
  const [activeShape, setActiveShape] = useState<Mode>("float");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();

    // seed positions/velocities (client-only — never during SSR render)
    pos.current = CARDS.map(() => ({
      x: Math.random() * (rect.width - CARD_W),
      y: Math.random() * (rect.height - CARD_H),
    }));
    vel.current = CARDS.map(() => ({
      x: (Math.random() - 0.5) * 2.4,
      y: (Math.random() - 0.5) * 2.4,
    }));

    const place = () =>
      pos.current.forEach((p, i) => {
        const el = cardEls.current[i];
        if (el) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      });

    if (mq.matches) {
      // Static fallback: lay the cards out as a calm spade, no animation.
      const r = host.getBoundingClientRect();
      const s = Math.min(r.width, r.height) * 0.32;
      spadePoints(CARDS.length).forEach((sp, i) => {
        pos.current[i] = {
          x: r.width / 2 + sp.x * s - CARD_W / 2,
          y: r.height / 2 + sp.y * s - CARD_H / 2,
        };
      });
      place();
      return;
    }

    let raf = 0;
    const tick = () => {
      const r = host.getBoundingClientRect();
      const obstacles = Array.from(
        host.querySelectorAll<HTMLElement>("[data-obstacle]")
      ).map((el) => el.getBoundingClientRect());

      pos.current.forEach((p, i) => {
        const v = vel.current[i];
        if (mode.current === "float") {
          p.x += v.x;
          p.y += v.y;
          if (p.x <= 0) (p.x = 0), (v.x = -v.x);
          if (p.x >= r.width - CARD_W) (p.x = r.width - CARD_W), (v.x = -v.x);
          if (p.y <= 0) (p.y = 0), (v.y = -v.y);
          if (p.y >= r.height - CARD_H) (p.y = r.height - CARD_H), (v.y = -v.y);
          for (const o of obstacles) bounceObstacle(p, v, o, r);
        } else {
          const t = target.current[i];
          if (t) {
            p.x += (t.x - p.x) * 0.09;
            p.y += (t.y - p.y) * 0.09;
          }
        }
        const el = cardEls.current[i];
        if (el) {
          const drift = mode.current === "float" ? Math.sin((Date.now() + i * 400) / 600) * 4 : 0;
          el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${drift}deg)`;
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const formShape = (m: Mode) => {
    setActiveShape(m);
    const host = hostRef.current;
    if (!host || reduced) return;
    mode.current = m;
    if (m === "float") {
      vel.current = CARDS.map(() => ({
        x: (Math.random() - 0.5) * 2.4,
        y: (Math.random() - 0.5) * 2.4,
      }));
      return;
    }
    const r = host.getBoundingClientRect();
    const s = Math.min(r.width, r.height) * 0.34;
    target.current = shapePoints(m, CARDS.length).map((sp) => ({
      x: r.width / 2 + sp.x * s - CARD_W / 2,
      y: r.height / 2 + sp.y * s - CARD_H / 2,
    }));
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 sm:px-8">
      <div className="glow" style={{ background: "#6e1f2b" }} aria-hidden />

      {/* The frame the cards bounce inside. */}
      <div
        ref={hostRef}
        className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center"
      >
        {/* Floating deck — decorative, behind the text. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {CARDS.map((c, i) => (
            <div
              key={i}
              ref={(el) => {
                cardEls.current[i] = el;
              }}
              className="absolute left-0 top-0 flex flex-col items-center justify-between rounded-md border border-gold/40 bg-[#1c0a12] p-1 shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
              style={{ width: CARD_W, height: CARD_H, willChange: "transform" }}
            >
              <span className="display self-start text-xs leading-none" style={{ color: c.hex }}>
                {c.rank}
              </span>
              <span className="text-lg leading-none" style={{ color: c.hex }}>
                {SUIT[c.suit]}
              </span>
              <span className="display self-end rotate-180 text-xs leading-none" style={{ color: c.hex }}>
                {c.rank}
              </span>
            </div>
          ))}
        </div>

        {/* The text the cards bounce against (data-obstacle). */}
        <div className="relative z-10 text-center" data-obstacle>
          <p className="microlabel mb-3 tracking-[0.3em] text-brass">
            ✦ &nbsp; a door that isn&apos;t there &nbsp; ✦
          </p>
          <h1 className="gilt display text-[clamp(5rem,22vw,12rem)] leading-none">404</h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted sm:text-base">
            This room was never dealt. The card you drew has slipped back into the
            deck — but the house has nine others waiting.
          </p>
        </div>

        {/* Controls */}
        <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3" data-obstacle>
          <Link
            href="/"
            className="microlabel rounded-full border border-brass px-5 py-2.5 text-gold transition hover:bg-brass/10"
          >
            back to the lobby
          </Link>
          {!reduced && (
            <>
              <button
                onClick={() => formShape("spade")}
                className={`microlabel rounded-full border px-5 py-2.5 transition ${
                  activeShape === "spade" ? "border-gold text-gold" : "border-line text-muted hover:border-brass"
                }`}
              >
                ♠ form a spade
              </button>
              <button
                onClick={() => formShape("constellation")}
                className={`microlabel rounded-full border px-5 py-2.5 transition ${
                  activeShape === "constellation" ? "border-gold text-gold" : "border-line text-muted hover:border-brass"
                }`}
              >
                ✦ constellation
              </button>
              <button
                onClick={() => formShape("float")}
                className="microlabel rounded-full border border-line px-5 py-2.5 text-muted transition hover:border-brass"
              >
                ↯ scatter
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
