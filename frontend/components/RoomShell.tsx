import Link from "next/link";
import SoundToggle from "@/components/SoundToggle";
import { CATEGORY_HEX } from "@/lib/types";
import type { Category } from "@/lib/types";

/** Single-screen room chrome: micro-label top-left, exit door bottom-left,
 *  drifting glow blob in the room's accent color (UI_SPEC layout rules). */
export default function RoomShell({
  label,
  accent,
  children,
}: {
  label: string;
  accent: Category;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-24 pt-6 sm:px-8">
      <div className="glow" style={{ background: CATEGORY_HEX[accent] }} aria-hidden />
      <header className="relative z-10 flex items-center justify-between">
        <span className="microlabel">{label}</span>
        <SoundToggle />
      </header>
      <div className="relative z-10 mx-auto mt-6 max-w-5xl">{children}</div>
      <Link
        href="/"
        className="microlabel fixed bottom-6 left-6 z-20 rounded-full border border-line bg-surface/80 px-4 py-2 backdrop-blur transition hover:border-ink"
      >
        ← Lobby
      </Link>
    </main>
  );
}
