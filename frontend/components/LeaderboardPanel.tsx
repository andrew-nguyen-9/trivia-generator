"use client";

import { useEffect, useState } from "react";
import { CATEGORY_HEX, type Category } from "@/lib/types";
import {
  fetchTop,
  getSavedName,
  submitScore,
  usesGlobalLeaderboard,
  type ScoreRow,
} from "@/lib/leaderboard";
import type { Room } from "@/lib/profile";

/** End-of-run leaderboard: submit your score, then see the top of the board.
 *  Global when Supabase is configured, otherwise a local (device) board. */
export default function LeaderboardPanel({
  room,
  score,
  accent,
}: {
  room: Room;
  score: number;
  accent: Category;
}) {
  const hex = CATEGORY_HEX[accent];
  const [name, setName] = useState("");
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const global = usesGlobalLeaderboard();

  useEffect(() => {
    setName(getSavedName());
    void fetchTop(room).then(setRows);
  }, [room]);

  async function submit() {
    setBusy(true);
    const updated = await submitScore(room, name, score);
    setRows(updated);
    setSubmitted(true);
    setBusy(false);
  }

  return (
    <div className="mt-8 w-full max-w-sm rounded-2xl border border-line bg-surface/60 p-5 text-left">
      <div className="flex items-center justify-between">
        <span className="microlabel" style={{ color: hex }}>
          {global ? "global leaderboard" : "local leaderboard"}
        </span>
        <span className="microlabel text-muted">top {Math.max(rows.length, 0) || 10}</span>
      </div>

      {!submitted ? (
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your initials"
            maxLength={12}
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
          />
          <button
            onClick={submit}
            disabled={busy}
            className="microlabel rounded-lg border px-4 py-2 transition disabled:opacity-40"
            style={{ borderColor: hex, color: hex }}
          >
            {busy ? "…" : `submit ${score}`}
          </button>
        </div>
      ) : null}

      <ol className="mt-4 space-y-1">
        {rows.length === 0 && (
          <li className="text-sm text-muted">be the first to post a score</li>
        )}
        {rows.slice(0, 10).map((r, idx) => (
          <li
            key={`${r.name}-${idx}`}
            className="flex items-center justify-between rounded-lg px-2 py-1 text-sm"
            style={idx === 0 ? { background: `${hex}18` } : undefined}
          >
            <span className="tabular text-muted">{idx + 1}.</span>
            <span className="flex-1 truncate px-2 font-bold">{r.name}</span>
            <span className="tabular font-black" style={{ color: hex }}>
              {r.score.toLocaleString()}
            </span>
          </li>
        ))}
      </ol>

      {!global && (
        <p className="microlabel mt-3 text-muted">
          scores stay on this device — set Supabase to go global
        </p>
      )}
    </div>
  );
}
