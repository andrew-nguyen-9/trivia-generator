"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LadderPuzzle, Rung, GridRung } from "@/lib/ladder";
import { sfxDoorLatch, sfxWrong, sfxPianoChord, sfxGlassClink } from "@/lib/sound";

const ACCENT = "#c8852a"; // history / the Trickster's climb
const BEST_KEY = "parlor.ladder.best.v1";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

const regionTint = (id: number, n: number, alpha: number) =>
  `hsl(${Math.round((id * 360) / n)} 45% 45% / ${alpha})`;

export default function LadderGame({
  puzzle,
  requestedDate,
}: {
  puzzle: LadderPuzzle | null;
  requestedDate?: string | null;
}) {
  const reduce = useReducedMotion();

  if (!puzzle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-5xl opacity-70" aria-hidden>
          🪜
        </p>
        <p className="text-muted">
          {requestedDate
            ? "No record of that ascent survives in the archive."
            : "The staircase has not yet been raised. Return when the Trickster builds it."}
        </p>
        <p className="microlabel text-smoke">the climb is forged nightly</p>
      </div>
    );
  }

  return <Climb puzzle={puzzle} reduce={!!reduce} />;
}

function Climb({ puzzle, reduce }: { puzzle: LadderPuzzle; reduce: boolean }) {
  const [idx, setIdx] = useState(0);
  const [placements, setPlacements] = useState<number[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [collapses, setCollapses] = useState(0);
  const [shake, setShake] = useState(false);
  const [won, setWon] = useState(false);
  const startedAt = useRef(Date.now());

  const rung = puzzle.rungs[idx];
  const total = elapsed + penalty;

  // init working state when the rung changes
  useEffect(() => {
    if (rung.type === "grid") setPlacements([...rung.givens]);
    else setChoice(null);
  }, [idx, rung]);

  useEffect(() => {
    if (won) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [won]);

  const collapse = useCallback(() => {
    const nth = collapses + 1;
    setPenalty((p) => p + (nth === 1 ? 90 : 180)); // +90 first, +180 thereafter
    setCollapses(nth);
    sfxWrong();
    if (!reduce) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    // the board collapses — re-trace from the givens / clear the choice
    if (rung.type === "grid") setPlacements([...rung.givens]);
    else setChoice(null);
  }, [collapses, reduce, rung]);

  function lock() {
    if (won) return;
    let correct = false;
    if (rung.type === "grid") {
      correct =
        placements.length === rung.n &&
        placements.every((c, r) => c === rung.solution[r]);
    } else {
      correct = choice === rung.answer;
    }
    if (!correct) {
      collapse();
      return;
    }
    sfxDoorLatch();
    if (idx + 1 >= puzzle.rungs.length) {
      setWon(true);
      sfxPianoChord();
      try {
        const prev = Number(localStorage.getItem(BEST_KEY) || 0);
        if (!prev || total < prev) localStorage.setItem(BEST_KEY, String(total));
      } catch {
        /* best-effort */
      }
    } else {
      setIdx((i) => i + 1);
    }
  }

  if (won) return <Summit puzzle={puzzle} seconds={total} collapses={collapses} />;

  return (
    <div className="mx-auto max-w-2xl">
      {/* HUD */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="microlabel" style={{ color: ACCENT }}>
            {puzzle.rite}
          </p>
          <p className="text-xs text-muted mt-0.5 max-w-md">{puzzle.framing}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-lg tabular-nums text-ink">⏱ {fmt(total)}</span>
          {collapses > 0 && (
            <span className="microlabel text-[#b22b2b]" title="board collapses (time penalty)">
              💥 ×{collapses}
            </span>
          )}
        </div>
      </div>

      {/* Rung pips */}
      <div className="mb-6 flex items-center justify-center gap-2" aria-label={`rung ${idx + 1} of ${puzzle.rungs.length}`}>
        {puzzle.rungs.map((r, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === idx ? 28 : 14,
              background: i < idx ? ACCENT : i === idx ? `${ACCENT}aa` : "var(--line,#2a2333)",
            }}
          />
        ))}
      </div>

      <motion.div
        animate={shake ? { x: [0, -10, 10, -7, 7, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-line bg-surface/70 p-5 sm:p-6"
      >
        {/* Trickster + resonance */}
        <div className="mb-4 flex items-center justify-between">
          <span className="microlabel text-smoke">
            rung {idx + 1} · {rung.modifier}
          </span>
          <span
            className="microlabel rounded-full border px-3 py-1"
            style={{ borderColor: `${ACCENT}66`, color: ACCENT }}
            title="Global Constraint Memory — carried up the staircase"
          >
            ✦ resonance {rung.resonance}
          </span>
        </div>
        <p className="mb-5 text-sm italic text-muted">“{rung.whisper}”</p>

        {rung.type === "grid" && (
          <GridRungView rung={rung} placements={placements} setPlacements={setPlacements} />
        )}
        {rung.type === "sequence" && (
          <SequenceRungView rung={rung} choice={choice} setChoice={setChoice} />
        )}
        {rung.type === "door" && (
          <DoorRungView rung={rung} choice={choice} setChoice={setChoice} />
        )}

        <button
          onClick={lock}
          className="mt-6 w-full rounded-full px-6 py-3 text-sm font-medium text-bg transition hover:brightness-110"
          style={{ background: ACCENT }}
        >
          ⟁ Lock this rung
        </button>
      </motion.div>

      <p className="mt-4 text-center microlabel text-smoke">
        a wrong lock collapses the board (+90s, then +180s) — there is no undo, only the climb
      </p>
    </div>
  );
}

function GridRungView({
  rung,
  placements,
  setPlacements,
}: {
  rung: GridRung;
  placements: number[];
  setPlacements: (p: number[]) => void;
}) {
  const { n, regions, givens } = rung;
  function tap(r: number, c: number) {
    if (givens[r] >= 0) return; // locked given
    const next = [...placements];
    next[r] = next[r] === c ? -1 : c;
    setPlacements(next);
    sfxGlassClink();
  }
  return (
    <div>
      <p className="mb-3 text-sm text-ink">
        Place one sigil ♛ in every row, column, and colour region — no two may touch,
        even diagonally.
      </p>
      <div className="overflow-x-auto">
        <div
          className="mx-auto grid w-max gap-1"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          role="grid"
          aria-label="Queens grid"
        >
          {Array.from({ length: n }, (_, r) =>
            Array.from({ length: n }, (_, c) => {
              const placed = placements[r] === c;
              const given = givens[r] === c;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => tap(r, c)}
                  disabled={given}
                  aria-label={`row ${r + 1}, column ${c + 1}${placed ? ", sigil placed" : ""}${given ? ", locked" : ""}`}
                  className="flex h-11 w-11 items-center justify-center rounded-md border text-xl transition focus:outline-none focus-visible:ring-2"
                  style={{
                    borderColor: "rgba(0,0,0,0.25)",
                    background: regionTint(regions[r][c], n, given ? 0.5 : 0.22),
                    color: given ? ACCENT : "#f3ead8",
                  }}
                >
                  <span aria-hidden>{placed || given ? "♛" : ""}</span>
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

function SequenceRungView({
  rung,
  choice,
  setChoice,
}: {
  rung: { shown: number[]; options: number[] };
  choice: number | null;
  setChoice: (i: number) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm text-ink">
        One rule generates this sequence. The obvious next step is the Trickster’s
        decoy — find the true continuation.
      </p>
      <div className="mb-5 flex flex-wrap items-center justify-center gap-2 font-mono text-lg">
        {rung.shown.map((v, i) => (
          <span key={i} className="rounded-md border border-line bg-bg/50 px-3 py-2 text-ink">
            {v}
          </span>
        ))}
        <span className="px-2 text-muted">→</span>
        <span className="rounded-md border border-dashed px-3 py-2" style={{ borderColor: ACCENT, color: ACCENT }}>
          ?
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {rung.options.map((v, i) => (
          <button
            key={i}
            onClick={() => setChoice(i)}
            aria-pressed={choice === i}
            className="rounded-xl border px-5 py-3 font-mono text-lg transition"
            style={{
              borderColor: choice === i ? ACCENT : "var(--line,#2a2333)",
              background: choice === i ? `${ACCENT}1f` : "transparent",
              color: choice === i ? ACCENT : "var(--ink,#f3ead8)",
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function DoorRungView({
  rung,
  choice,
  setChoice,
}: {
  rung: { doors: string[] };
  choice: number | null;
  setChoice: (i: number) => void;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-ink">
        Only one door speaks the truth about the resonance you carry. Choose it.
      </p>
      <div className="grid gap-3">
        {rung.doors.map((d, i) => (
          <button
            key={i}
            onClick={() => setChoice(i)}
            aria-pressed={choice === i}
            className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition"
            style={{
              borderColor: choice === i ? ACCENT : "var(--line,#2a2333)",
              background: choice === i ? `${ACCENT}1f` : "transparent",
            }}
          >
            <span className="text-xl" aria-hidden>🚪</span>
            <span className="text-ink">{d}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Summit({
  puzzle,
  seconds,
  collapses,
}: {
  puzzle: LadderPuzzle;
  seconds: number;
  collapses: number;
}) {
  const [copied, setCopied] = useState(false);
  const perfect = collapses === 0;
  const best = useMemo(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY) || 0);
    } catch {
      return 0;
    }
  }, []);
  const glyph = (r: Rung) => (r.type === "grid" ? "🟧" : r.type === "sequence" ? "🔢" : "🚪");
  const share = useMemo(
    () =>
      [
        `🪜 Climb of the Initiate — ${puzzle.rite}`,
        `⏱ ${fmt(seconds)}  ${perfect ? "PERFECT ASCENT ✦" : `💥 ${collapses}`}`,
        puzzle.rungs.map(glyph).join(""),
        `parlor · ${puzzle.date}`,
      ].join("\n"),
    [puzzle, seconds, collapses, perfect],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 text-center"
    >
      <p className="microlabel tracking-widest" style={{ color: ACCENT }}>
        the summit
      </p>
      <p className="font-mono text-5xl tabular-nums" style={{ color: ACCENT }}>
        {fmt(seconds)}
      </p>
      {perfect ? (
        <p className="display text-2xl" style={{ color: ACCENT }}>
          ✦ Perfect Ascent
        </p>
      ) : (
        <p className="text-sm text-muted">
          {collapses} collapse{collapses > 1 ? "s" : ""} on the way up.
        </p>
      )}
      <p className="text-2xl">{puzzle.rungs.map(glyph).join("")}</p>
      <button
        onClick={() =>
          navigator.clipboard?.writeText(share).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
        className="rounded-full px-6 py-3 text-sm font-medium text-bg transition hover:brightness-110"
        style={{ background: ACCENT }}
      >
        {copied ? "copied ✓" : "share ascent"}
      </button>
      {best > 0 && <p className="microlabel text-smoke">best ascent · {fmt(best)}</p>}
    </motion.div>
  );
}
