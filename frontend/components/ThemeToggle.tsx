"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "parlor.theme";

// Resolve + apply a theme onto <html data-theme>. The same resolution runs in the
// inline no-flash script in layout.tsx before paint; this keeps React in sync.
function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode — best effort */
  }
}

/** Persistent light/dark toggle. Reads the theme the no-flash script already set. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }

  return (
    <button
      onClick={toggle}
      className="microlabel fixed bottom-6 right-6 z-30 flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 py-2 backdrop-blur transition hover:border-brass"
      aria-label={theme === "dark" ? "switch to light theme" : "switch to dark theme"}
      title={theme === "dark" ? "daylit tour" : "candlelight"}
    >
      <span aria-hidden>{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
