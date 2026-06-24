"use client";

import { useEffect, useState } from "react";
import { CATEGORY_HEX, CATEGORY_LABEL } from "@/lib/types";
import type { SavedQ } from "@/lib/usePractice";

export default function PracticeBar({
  practiceMode,
  onToggle,
  saved,
  onRemove,
}: {
  practiceMode: boolean;
  onToggle: () => void;
  saved: SavedQ[];
  onRemove: (prompt: string) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);

  // Escape closes the saved-questions panel (it's a dismissible dialog, unlike
  // a committed board question). Shared by every room, so this lands everywhere.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanelOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  return (
    <>
      <div className="mt-10 flex items-center justify-between border-t border-line pt-4">
        <button
          onClick={onToggle}
          className={`microlabel rounded-full border px-4 py-2 transition ${
            practiceMode
              ? "border-wildcard text-wildcard"
              : "border-line text-muted hover:border-ink hover:text-ink"
          }`}
        >
          {practiceMode ? "◉ practice mode on" : "◎ practice mode"}
        </button>

        {saved.length > 0 && (
          <button
            onClick={() => setPanelOpen(true)}
            className="microlabel rounded-full border border-line px-4 py-2 text-muted transition hover:border-ink hover:text-ink"
          >
            {saved.length} saved →
          </button>
        )}
      </div>

      {panelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-4 backdrop-blur"
          onClick={() => setPanelOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`saved questions, ${saved.length}`}
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="microlabel">saved questions ({saved.length})</span>
              <button
                onClick={() => setPanelOpen(false)}
                className="microlabel text-muted hover:text-ink"
              >
                close ×
              </button>
            </div>
            <div className="space-y-3">
              {[...saved].reverse().map((q) => (
                <div key={q.prompt} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span
                        className="microlabel"
                        style={{ color: CATEGORY_HEX[q.category] }}
                      >
                        {CATEGORY_LABEL[q.category]} · {q.qtype.replace("_", " ")}
                      </span>
                      <p className="mt-1 text-sm font-bold">{q.prompt}</p>
                      <p className="mt-1 text-xs text-muted">{q.correct}</p>
                    </div>
                    <button
                      onClick={() => onRemove(q.prompt)}
                      className="microlabel shrink-0 text-muted transition hover:text-music"
                    >
                      remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
