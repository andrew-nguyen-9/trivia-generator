"use client";

import { useEffect, useRef } from "react";

const SUITS = ["♦", "♣", "♥", "♠", "✦", "✧"];
const GOLDS = ["#d4af37", "#b8902e", "#f5c518", "#c8963c", "#f0ede6"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotV: number;
  color: string;
  symbol: string;
  size: number;
  opacity: number;
  fade: number;
}

function mkParticle(w: number): Particle {
  return {
    x: Math.random() * w,
    y: -20,
    vx: (Math.random() - 0.5) * 2.5,
    vy: 1.5 + Math.random() * 2.5,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 8,
    color: GOLDS[Math.floor(Math.random() * GOLDS.length)],
    symbol: SUITS[Math.floor(Math.random() * SUITS.length)],
    size: 10 + Math.random() * 14,
    opacity: 0.9 + Math.random() * 0.1,
    fade: 0.004 + Math.random() * 0.006,
  };
}

// Accepts either prop style: `active` (boolean, used by The Ladder) or `trigger`
// (an incrementing counter, used by the older rooms). A burst fires when `active`
// becomes true or each time `trigger` changes to a new value.
export default function Confetti({
  active,
  trigger = 0,
  count = 80,
}: {
  active?: boolean;
  trigger?: number;
  count?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>(0);
  const spawned = useRef(0);

  const fire = Boolean(active) || trigger > 0;

  useEffect(() => {
    if (!fire) {
      cancelAnimationFrame(raf.current);
      particles.current = [];
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    particles.current = [];
    spawned.current = 0;

    const TOTAL = count;
    const BURST = 4;

    function tick() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn burst
      if (spawned.current < TOTAL) {
        for (let i = 0; i < BURST && spawned.current < TOTAL; i++) {
          particles.current.push(mkParticle(canvas.width));
          spawned.current++;
        }
      }

      // Update + draw
      ctx.save();
      particles.current = particles.current.filter((p) => p.opacity > 0.01);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // gravity
        p.rot += p.rotV;
        p.opacity -= p.fade;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.font = `${p.size}px serif`;
        ctx.fillStyle = p.color;
        ctx.fillText(p.symbol, -p.size / 2, p.size / 3);
        ctx.restore();
      }
      ctx.restore();

      if (particles.current.length > 0 || spawned.current < TOTAL) {
        raf.current = requestAnimationFrame(tick);
      }
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [fire, trigger, count]);

  if (!fire) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      aria-hidden
    />
  );
}
