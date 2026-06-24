"use client";

import { useEffect } from "react";

// Tracks the pointer and publishes its viewport position as CSS vars (--mx/--my,
// in %) on <html>. Gold elements use them as a moving specular highlight, so all
// gilt on the page catches light from one cursor-driven source. rAF-throttled,
// passive listener; disabled under prefers-reduced-motion (the gold stays static).
export default function GoldSheen() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let raf = 0;
    let x = 50;
    let y = 30;

    const apply = () => {
      raf = 0;
      root.style.setProperty("--mx", `${x}%`);
      root.style.setProperty("--my", `${y}%`);
    };
    const onMove = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth) * 100;
      y = (e.clientY / window.innerHeight) * 100;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
