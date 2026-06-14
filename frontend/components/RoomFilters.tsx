"use client";

import { DECKS } from "@/lib/decks";
import { CATEGORY_HEX, type Category } from "@/lib/types";

const DIFFS: { id: "any" | "easy" | "medium" | "hard"; label: string }[] = [
  { id: "any", label: "any" },
  { id: "easy", label: "easy" },
  { id: "medium", label: "medium" },
  { id: "hard", label: "hard" },
];

/** Compact deck + difficulty chooser. Controlled by the parent room. */
export default function RoomFilters({
  deck,
  setDeck,
  diff,
  setDiff,
  accent,
  decks = true,
}: {
  deck: string;
  setDeck: (d: string) => void;
  diff: "any" | "easy" | "medium" | "hard";
  setDiff: (d: "any" | "easy" | "medium" | "hard") => void;
  accent: Category;
  decks?: boolean;
}) {
  const hex = CATEGORY_HEX[accent];
  return (
    <div className="w-full max-w-lg space-y-4">
      {decks && (
        <div>
          <p className="microlabel mb-2">deck</p>
          <div className="flex flex-wrap justify-center gap-2">
            {DECKS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDeck(d.id)}
                className="microlabel rounded-full border px-3 py-1.5 transition"
                style={
                  deck === d.id
                    ? { borderColor: hex, color: hex, background: `${hex}18` }
                    : { borderColor: "#26263a", color: "#8b8b9e" }
                }
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="microlabel mb-2">difficulty</p>
        <div className="flex justify-center gap-2">
          {DIFFS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDiff(d.id)}
              className="microlabel rounded-full border px-4 py-1.5 transition"
              style={
                diff === d.id
                  ? { borderColor: hex, color: hex, background: `${hex}18` }
                  : { borderColor: "#26263a", color: "#8b8b9e" }
              }
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
