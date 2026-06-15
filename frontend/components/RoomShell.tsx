import Link from "next/link";
import { CATEGORY_HEX } from "@/lib/types";
import type { Category } from "@/lib/types";

const SUIT: Record<Category, string> = {
  history: "♦",
  music: "♥",
  sports: "♣",
  screen: "♠",
  geography: "✦",
  wildcard: "✧",
};

/** Room chrome: brass doorway frame, engraved nameplate, exit back to lobby. */
export default function RoomShell({
  label,
  accent,
  children,
}: {
  label: string;
  accent: Category;
  children: React.ReactNode;
}) {
  const hex = CATEGORY_HEX[accent];
  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-24 pt-6 sm:px-8">
      <div className="glow" style={{ background: hex }} aria-hidden />

      {/* Brass doorway top rule */}
      <div
        className="absolute left-0 right-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}66, transparent)` }}
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-between">
        {/* Engraved nameplate */}
        <div className="flex items-center gap-2">
          <span style={{ color: hex }} className="text-sm opacity-70">
            {SUIT[accent]}
          </span>
          <span className="microlabel">{label}</span>
        </div>
        <span className="microlabel" style={{ color: `${hex}99` }}>
          parlor
        </span>
      </header>

      {/* Thin brass accent rule under header */}
      <div className="relative z-10 mt-3 border-t brass-rule" aria-hidden />

      <div className="relative z-10 mx-auto mt-6 max-w-5xl">{children}</div>

      <Link
        href="/"
        className="microlabel fixed bottom-6 left-6 z-20 flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-2 backdrop-blur transition hover:border-brass"
      >
        <span className="opacity-60">←</span> Lobby
      </Link>
    </main>
  );
}
