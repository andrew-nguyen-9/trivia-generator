"use client";

import { HOURS, ROOMS, type MysteryCase } from "@/lib/mystery";

function displayRoom(r: string): string {
  return r.replace(/^the /, "The ");
}

export default function MysteryAccusationForm({
  mystery,
  whoGuess,
  whereGuess,
  whenGuess,
  onWhereChange,
  onWhenChange,
  onSubmit,
}: {
  mystery: MysteryCase;
  whoGuess: string[];
  whereGuess: string | null;
  whenGuess: number | null;
  onWhereChange: (room: string) => void;
  onWhenChange: (hourIndex: number) => void;
  onSubmit: () => void;
}) {
  const canSubmit = whoGuess.length > 0 && whereGuess !== null && whenGuess !== null;

  return (
    <div className="gilt-frame mt-6 rounded-2xl bg-surface/60 p-5">
      <p className="microlabel mb-3 text-gold">submit accusation</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="microlabel mb-1 text-muted">who</p>
          <div className="rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm text-ink/80">
            {whoGuess.length > 0 ? `${whoGuess.length} marked PRIME` : "tag suspects PRIME"}
          </div>
        </div>
        <div>
          <p className="microlabel mb-1 text-muted">where</p>
          <select
            value={whereGuess ?? ""}
            onChange={(e) => onWhereChange(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm text-ink"
          >
            <option value="" disabled>
              room
            </option>
            {ROOMS.map((room) => (
              <option key={room} value={room}>
                {displayRoom(room)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="microlabel mb-1 text-muted">when</p>
          <select
            value={whenGuess ?? ""}
            onChange={(e) => onWhenChange(Number(e.target.value))}
            className="w-full rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm text-ink"
          >
            <option value="" disabled>
              hour
            </option>
            {HOURS.map((hour, i) => (
              <option key={hour} value={i}>
                {hour}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="microlabel mt-4 w-full rounded-full border border-ember py-3 text-ember transition enabled:hover:bg-ember enabled:hover:text-ink disabled:opacity-40"
      >
        submit verdict
      </button>
    </div>
  );
}
