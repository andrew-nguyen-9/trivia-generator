"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LadderPuzzle, GridRung } from "@/lib/ladder";
import { buildShare, type Tier } from "@/lib/share";
import { sfxDoorLatch, sfxWrong, sfxPianoChord, sfxGlassClink } from "@/lib/sound";
import styles from "./LadderGame.module.css";

const ACCENT = "#c8852a"; // history / the Trickster's climb
const BEST_KEY = "parlor.ladder.best.v1";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

const regionTint = (id: number, n: number, alpha: number) =>
  `hsl(${Math.round((id * 360) / n)} 45% 45% / ${alpha})`;

// ── Grid constraint check (UI-side): which placed rows break a constraint.
// One sigil per row is enforced by the data model, so only column, colour-region
// and orthogonal/diagonal adjacency can conflict. Returns the offending rows so
// the board can glow them live — this is the whole point of the refurb. ──
function conflictRows(placements: number[], regions: number[][]): Set<number> {
  const bad = new Set<number>();
  const rows = placements.map((c, r) => [r, c] as const).filter(([, c]) => c >= 0);
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const [ra, ca] = rows[i];
      const [rb, cb] = rows[j];
      const sameCol = ca === cb;
      const sameRegion = regions[ra][ca] === regions[rb][cb];
      const touching = Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1;
      if (sameCol || sameRegion || touching) {
        bad.add(ra);
        bad.add(rb);
      }
    }
  }
  return bad;
}

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
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [collapses, setCollapses] = useState(0);
  // per-rung: false once a collapse happens on that rung (drives 🟩 vs 🟨 share)
  const [clean, setClean] = useState<boolean[]>(() => puzzle.rungs.map(() => true));
  const [shake, setShake] = useState(false);
  const [won, setWon] = useState(false);
  const startedAt = useRef(Date.now());

  const rung = puzzle.rungs[idx];
  const total = elapsed + penalty;

  // init working state when the rung changes
  useEffect(() => {
    if (rung.type === "grid") setPlacements([...rung.givens]);
    else setChoice(null);
    setMarks(new Set());
  }, [idx, rung]);

  useEffect(() => {
    if (won) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [won]);

  // live conflict set for the active grid rung (cheap: n ≤ 6)
  const conflicts = useMemo(
    () => (rung.type === "grid" ? conflictRows(placements, rung.regions) : new Set<number>()),
    [rung, placements],
  );

  // the Lock gate: a grid is lockable only when complete AND conflict-free
  // (deduction does the work); sequence/door need a selection to risk.
  const canLock =
    rung.type === "grid"
      ? placements.length === rung.n && placements.every((c) => c >= 0) && conflicts.size === 0
      : choice !== null;

  const collapse = useCallback(() => {
    const nth = collapses + 1;
    setPenalty((p) => p + (nth === 1 ? 90 : 180)); // +90 first, +180 thereafter
    setCollapses(nth);
    setClean((cl) => cl.map((v, i) => (i === idx ? false : v)));
    sfxWrong();
    if (!reduce) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    // the board collapses — re-trace from the givens / clear the choice
    if (rung.type === "grid") setPlacements([...rung.givens]);
    else setChoice(null);
    setMarks(new Set());
  }, [collapses, reduce, rung, idx]);

  function lock() {
    if (won || !canLock) return;
    let correct = false;
    if (rung.type === "grid") {
      correct =
        placements.length === rung.n &&
        placements.every((c, r) => c === rung.solution[r]);
    } else if (rung.type === "sequence") {
      // choice is an option INDEX; rung.answer is the correct VALUE
      correct = choice !== null && rung.options[choice] === rung.answer;
    } else {
      // door: rung.answer is the index of the truthful door
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

  if (won) return <Summit puzzle={puzzle} seconds={total} collapses={collapses} clean={clean} />;

  return (
    <div className="mx-auto max-w-2xl">
      {/* HUD — one row: rite on the left, timer + collapses right */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="microlabel" style={{ color: ACCENT }}>
          {puzzle.rite}
        </p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg tabular-nums text-ink">⏱ {fmt(total)}</span>
          {collapses > 0 && (
            <span className="microlabel text-[#b22b2b]" title="board collapses (time penalty)">
              💥 ×{collapses}
            </span>
          )}
        </div>
      </div>

      {/* Rung pips */}
      <div
        className="mb-3 flex items-center justify-center gap-2"
        aria-label={`rung ${idx + 1} of ${puzzle.rungs.length}`}
      >
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
        className="rounded-2xl border border-line bg-surface/70 p-4 sm:p-5"
      >
        {/* Trickster + resonance */}
        <div className="mb-2 flex items-center justify-between gap-3">
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
        <p className="mb-3 truncate text-xs italic text-muted" title={rung.whisper}>
          “{rung.whisper}”
        </p>

        {rung.type === "grid" && (
          <GridRungView
            rung={rung}
            placements={placements}
            setPlacements={setPlacements}
            marks={marks}
            setMarks={setMarks}
            conflicts={conflicts}
          />
        )}
        {rung.type === "sequence" && (
          <SequenceRungView rung={rung} choice={choice} setChoice={setChoice} />
        )}
        {rung.type === "door" && (
          <DoorRungView rung={rung} choice={choice} setChoice={setChoice} />
        )}

        <button
          onClick={lock}
          disabled={!canLock}
          title={
            rung.type === "grid"
              ? "fill every row with no two sigils sharing a column, region, or touching"
              : "select an answer, then lock — a wrong lock collapses the board (+90s, then +180s)"
          }
          className="mt-5 w-full rounded-full px-6 py-3 text-sm font-medium text-bg transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {rung.type === "grid" && !canLock ? "⟁ Resolve every constraint to lock" : "⟁ Lock this rung"}
        </button>
      </motion.div>
    </div>
  );
}

function GridRungView({
  rung,
  placements,
  setPlacements,
  marks,
  setMarks,
  conflicts,
}: {
  rung: GridRung;
  placements: number[];
  setPlacements: (p: number[]) => void;
  marks: Set<string>;
  setMarks: (m: Set<string>) => void;
  conflicts: Set<number>;
}) {
  const { n, regions, givens } = rung;

  // tap cycles a free cell: empty → ✕ (elimination note) → ♛ sigil → empty
  function tap(r: number, c: number) {
    if (givens[r] >= 0) return; // locked given
    const key = `${r}-${c}`;
    if (placements[r] === c) {
      // ♛ → empty
      const next = [...placements];
      next[r] = -1;
      setPlacements(next);
    } else if (marks.has(key)) {
      // ✕ → ♛ (one sigil per row; this overwrites any other sigil in the row)
      const m = new Set(marks);
      m.delete(key);
      setMarks(m);
      const next = [...placements];
      next[r] = c;
      setPlacements(next);
    } else {
      // empty → ✕
      const m = new Set(marks);
      m.add(key);
      setMarks(m);
    }
    sfxGlassClink();
  }

  return (
    <div>
      <p className="mb-3 text-xs text-ink">
        One sigil ♛ per row, column, and colour region — none may touch, even
        diagonally. Tap once to mark ✕, again for ♛.
      </p>
      <div
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Queens grid"
      >
        {Array.from({ length: n }, (_, r) =>
          Array.from({ length: n }, (_, c) => {
            const placed = placements[r] === c;
            const given = givens[r] === c;
            const marked = marks.has(`${r}-${c}`);
            const bad = (placed || given) && conflicts.has(r);
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => tap(r, c)}
                disabled={given}
                aria-label={`row ${r + 1}, column ${c + 1}${placed || given ? ", sigil placed" : marked ? ", marked" : ""}${given ? ", locked" : ""}${bad ? ", conflict" : ""}`}
                className={`${styles.cell} ${bad ? styles.conflict : ""}`}
                style={{
                  background: regionTint(regions[r][c], n, given ? 0.5 : 0.22),
                  color: given ? ACCENT : "#f3ead8",
                }}
              >
                <span aria-hidden className={marked ? styles.mark : undefined}>
                  {placed || given ? "♛" : marked ? "✕" : ""}
                </span>
              </button>
            );
          }),
        )}
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
  const [showDiffs, setShowDiffs] = useState(false);
  const diffs = rung.shown.slice(1).map((v, i) => v - rung.shown[i]);
  return (
    <div>
      <p className="mb-3 text-xs text-ink">
        One rule generates this sequence. The obvious next step is the Trickster’s
        decoy — find the true continuation.
      </p>
      <div className="mb-2 flex flex-wrap items-center justify-center gap-2 font-mono text-lg">
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
      <div className="mb-4 text-center">
        {showDiffs ? (
          <p className="font-mono text-xs text-smoke">
            differences&nbsp; {diffs.map((d) => (d >= 0 ? `+${d}` : `${d}`)).join("  ")}
          </p>
        ) : (
          <button
            onClick={() => setShowDiffs(true)}
            className="microlabel text-smoke underline-offset-2 hover:underline"
          >
            show first differences
          </button>
        )}
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
      <p className="mb-3 text-xs text-ink">
        Only one door speaks the truth about the resonance you carry. Choose it.
      </p>
      <div className="grid gap-2">
        {rung.doors.map((d, i) => (
          <button
            key={i}
            onClick={() => setChoice(i)}
            aria-pressed={choice === i}
            className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition"
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
  clean,
}: {
  puzzle: LadderPuzzle;
  seconds: number;
  collapses: number;
  clean: boolean[];
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

  // The solved result, via the canonical share seam (lib/share.ts): one tier per
  // rung — 🟩 cleared first try, 🟨 cleared after a collapse. One row, no DB.
  const card = useMemo(() => {
    const tiers: Tier[] = clean.map((c) => (c ? "hit" : "near") as Tier);
    return buildShare({
      room: "/ladder",
      date: puzzle.date,
      tiers,
      score: clean.filter(Boolean).length,
      maxScore: clean.length,
      columns: clean.length,
    });
  }, [clean, puzzle.date]);

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
      <p className="text-2xl tracking-[0.2em]">{card.grid}</p>
      <button
        onClick={() =>
          navigator.clipboard?.writeText(card.text).then(() => {
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
