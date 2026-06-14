"use client";

import { useState, useEffect, useCallback } from "react";
import type { Question } from "./types";

const SAVED_KEY = "parlor:saved";

export type SavedQ = Question & { _savedAt: number };

export function usePractice() {
  const [practiceMode, setPracticeMode] = useState(false);
  const [saved, setSaved] = useState<SavedQ[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw) as SavedQ[]);
    } catch {
      // ignore corrupt localStorage
    }
  }, []);

  const saveQ = useCallback((q: Question) => {
    setSaved((prev) => {
      if (prev.some((p) => p.prompt === q.prompt)) return prev;
      const next: SavedQ[] = [...prev, { ...q, _savedAt: Date.now() }];
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removeQ = useCallback((prompt: string) => {
    setSaved((prev) => {
      const next = prev.filter((p) => p.prompt !== prompt);
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const isSaved = useCallback(
    (q: Question) => saved.some((p) => p.prompt === q.prompt),
    [saved],
  );

  return {
    practiceMode,
    togglePractice: () => setPracticeMode((v) => !v),
    saved,
    saveQ,
    removeQ,
    isSaved,
  };
}
