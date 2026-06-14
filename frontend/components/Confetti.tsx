"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

const COLORS = ["#ffb43a", "#ff4fa3", "#3ddc84", "#4f9dff", "#2fd4c4", "#b07aff"];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; size: number; color: string; life: number;
}

/** Full-screen canvas confetti. Each increment of `trigger` fires a fresh burst. */
export default function Confetti({ trigger, count = 120 }: { trigger: number; count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (trigger === 0 || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cx = canvas.width / 2;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * (0.15 + Math.random() * 0.7)) * -1; // upward fan
      const speed = 6 + Math.random() * 9;
      particles.current.push({
        x: cx + (Math.random() - 0.5) * 120,
        y: canvas.height * 0.5,
        vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        size: 5 + Math.random() * 7,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
      });
    }

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravity
        p.vx *= 0.99;
        p.rot += p.vr;
        p.life -= 0.009;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (particles.current.length > 0) {
        raf.current = requestAnimationFrame(tick);
      }
    };
    cancelAnimationFrame(raf.current ?? 0);
    raf.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf.current ?? 0);
  }, [trigger, count, reduced]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-hidden
    />
  );
}
