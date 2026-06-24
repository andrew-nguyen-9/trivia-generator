// In-game settings for THE BOARD, persisted to localStorage (the frontend never
// writes to the DB — see CLAUDE.md). prefers-reduced-motion is honoured in
// addition to the explicit toggle (handled by the consumer via framer-motion's
// useReducedMotion OR'd with the stored flag).
"use client";

import { useEffect, useState } from "react";

export type TextSize = "S" | "M" | "L";

export interface BoardSettings {
  textSize: TextSize;
  hints: boolean; // show blurred-image clues / extra help
  reducedMotion: boolean; // user override; OR'd with the OS setting
}

const KEY = "parlor.board.settings";

const DEFAULTS: BoardSettings = { textSize: "M", hints: true, reducedMotion: false };

export const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  S: "text-sm",
  M: "text-base",
  L: "text-lg",
};

export function useBoardSettings() {
  const [settings, setSettings] = useState<BoardSettings>(DEFAULTS);

  // Load once on mount (client only — SSR renders the defaults, no hydration risk
  // since the panel is purely interactive chrome).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* corrupt/blocked storage → keep defaults */
    }
  }, []);

  function update(patch: Partial<BoardSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage blocked → in-memory only */
      }
      return next;
    });
  }

  return { settings, update };
}
