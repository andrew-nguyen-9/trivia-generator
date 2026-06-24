"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SeancePuzzle } from "@/lib/seance";
import { recordBanishing, loadGrimoire, spiritsBanished } from "@/lib/grimoire";
import { sfxGlassClink, sfxWrong, sfxPianoChord, sfxDoorLatch } from "@/lib/sound";

const ACCENT = "#7040a8"; // wildcard / the Medium

type Mark = 0 | 1 | 2; // none | exclude (snuffed candle) | confirm (glowing rune)
// marks[cat][seat][val]
type Board = Mark[][][];

function emptyBoard(p: SeancePuzzle): Board {
  return p.categories.map(() =>
    Array.from({ length: p.n }, () => Array<Mark>(p.n).fill(0)),
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function SeanceGame({
  puzzle,
  requestedDate,
}: {
  puzzle: SeancePuzzle | null;
  requestedDate?: string | null;
}) {
  const reduce = useReducedMotion();

  // ── Dark state: no archived puzzle. NO offline fallback (by design). ──
  if (!puzzle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-5xl opacity-70" aria-hidden>
          🕯️
        </p>
        <p className="text-muted">
          {requestedDate
            ? "No record of that night survives in the archive."
            : "The veil is closed. No spirit waits at the table tonight."}
        </p>
        <p className="microlabel text-smoke">
          the séance is summoned nightly — return when the candles are lit
        </p>
      </div>
    );
  }

  return <SeanceTable puzzle={puzzle} reduce={!!reduce} />;
}

function SeanceTable({ puzzle, reduce }: { puzzle: SeancePuzzle; reduce: boolean }) {
  const [board, setBoard] = useState<Board>(() => emptyBoard(puzzle));
  const [whisper, setWhisper] = useState<Board>(() => emptyBoard(puzzle));
  const [whisperMode, setWhisperMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [copied, setCopied] = useState(false);
  const startedAt = useRef(Date.now());

  const total = elapsed + strikes * 60;

  // count-up "Ectoplasmic Decay" timer
  useEffect(() => {
    if (won) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [won]);

  // atmospheric pressure: vignette deepens with time (frozen if reduced-motion)
  const pressure = reduce ? 0.25 : Math.min(0.85, 0.18 + total / 900);

  const layer = whisperMode ? whisper : board;
  const setLayer = whisperMode ? setWhisper : setBoard;

  const cycle = useCallback(
    (c: number, seat: number, val: number) => {
      if (won) return;
      setLayer((prev) => {
        const next = prev.map((cat) => cat.map((row) => row.slice()));
        const cur = next[c][seat][val];
        const nv: Mark = (((cur + 1) % 3) as Mark);
        next[c][seat][val] = nv;
        // auto-propagation on confirm: snuff the rest of the row + column
        // (only empty cells; manual marks are left intact — clear them by hand).
        if (nv === 2) {
          for (let s = 0; s < puzzle.n; s++)
            if (s !== seat && next[c][s][val] === 0) next[c][s][val] = 1;
          for (let v = 0; v < puzzle.n; v++)
            if (v !== val && next[c][seat][v] === 0) next[c][seat][v] = 1;
        }
        return next;
      });
      if (!whisperMode) {
        const cur = board[c][seat][val];
        if ((cur + 1) % 3 === 2) sfxGlassClink();
      }
    },
    [board, puzzle.n, setLayer, whisperMode, won],
  );

  function submit() {
    if (won) return;
    // valid iff every category/seat has exactly one confirm AND it matches truth
    let ok = true;
    for (let c = 0; c < puzzle.categories.length && ok; c++) {
      for (let seat = 0; seat < puzzle.n && ok; seat++) {
        const confirms = board[c][seat]
          .map((m, v) => (m === 2 ? v : -1))
          .filter((v) => v >= 0);
        if (confirms.length !== 1 || puzzle.solution[c][seat] !== confirms[0]) {
          ok = false;
        }
      }
    }
    if (ok) {
      setWon(true);
      sfxPianoChord();
      recordBanishing({
        spirit: puzzle.spirit,
        date: puzzle.date,
        rite: puzzle.rite,
        seconds: total,
        strikes,
      });
    } else {
      // Poltergeist Strike: +60s, shake the table
      setStrikes((s) => s + 1);
      sfxWrong();
      if (!reduce) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }
  }

  if (won) {
    return <Banished puzzle={puzzle} seconds={total} strikes={strikes} copied={copied} setCopied={setCopied} />;
  }

  return (
    <motion.div
      className="relative mx-auto max-w-4xl"
      animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        // edges darken as the séance drags on
        boxShadow: `inset 0 0 140px ${pressure * 100}px rgba(8,4,14,${pressure})`,
        borderRadius: 24,
      }}
    >
      {/* HUD */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="microlabel" style={{ color: ACCENT }}>
            {puzzle.rite} · {puzzle.spirit}
          </p>
          <p className="text-xs text-muted mt-0.5 max-w-md">{puzzle.backstory}</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <span className="font-mono text-lg tabular-nums text-ink" aria-live="off">
            ⏱ {fmt(total)}
          </span>
          {strikes > 0 && (
            <span className="microlabel text-[#b22b2b]" title="poltergeist strikes (+60s each)">
              💀 ×{strikes}
            </span>
          )}
        </div>
      </div>

      {/* Clues — the corrupted message */}
      <div className="mb-6 rounded-2xl border border-line bg-surface/70 p-4">
        <p className="microlabel mb-2 text-smoke">the spirit whispers ({puzzle.clues.length})</p>
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {puzzle.clues.map((cl, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink">
              <span className="text-smoke select-none">✦</span>
              <span>{cl.text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* The Scrying Matrix */}
      <div className="space-y-6 overflow-x-auto pb-2">
        {puzzle.categories.map((cat, c) => (
          <Grid
            key={cat.key}
            puzzle={puzzle}
            cat={c}
            layer={board}
            whisperLayer={whisper}
            onCell={cycle}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {puzzle.whisper && (
            <>
              <button
                onClick={() => {
                  setWhisperMode((w) => !w);
                  sfxDoorLatch();
                }}
                aria-pressed={whisperMode}
                className="microlabel rounded-full border px-4 py-2 transition"
                style={{
                  borderColor: whisperMode ? ACCENT : "var(--line, #2a2333)",
                  color: whisperMode ? ACCENT : undefined,
                  background: whisperMode ? `${ACCENT}1a` : undefined,
                }}
              >
                {whisperMode ? "✎ whisper: on" : "✎ whisper"}
              </button>
              {whisperMode && (
                <button
                  onClick={() => setWhisper(emptyBoard(puzzle))}
                  className="microlabel text-smoke hover:text-muted"
                >
                  clear draft
                </button>
              )}
            </>
          )}
        </div>
        <button
          onClick={submit}
          className="rounded-full px-6 py-3 text-sm font-medium text-bg transition hover:brightness-110"
          style={{ background: ACCENT }}
        >
          ✦ Stabilise the Séance
        </button>
      </div>

      <p className="mt-4 text-center microlabel text-smoke">
        tap once to snuff (✕) · tap twice to bind (◯) · a wrong submission costs +60s
        {puzzle.whisper ? " · whisper mode is a scratchpad" : ""}
      </p>
    </motion.div>
  );
}

function Grid({
  puzzle,
  cat,
  layer,
  whisperLayer,
  onCell,
}: {
  puzzle: SeancePuzzle;
  cat: number;
  layer: Board;
  whisperLayer: Board;
  onCell: (c: number, seat: number, val: number) => void;
}) {
  const c = puzzle.categories[cat];
  const seatLabel = (s: number) => `${s + 1}`;
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-3">
      <p className="microlabel mb-2" style={{ color: ACCENT }}>
        {c.label}
      </p>
      <table className="border-collapse text-xs" role="grid" aria-label={`${c.label} matrix`}>
        <thead>
          <tr>
            <th className="w-10 p-1 text-left text-smoke font-normal">seat</th>
            {c.values.map((v) => (
              <th
                key={v}
                className="max-w-[5.5rem] p-1 align-bottom text-[10px] font-normal leading-tight text-muted"
              >
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: puzzle.n }, (_, seat) => (
            <tr key={seat}>
              <th className="p-1 text-left text-smoke font-normal" scope="row">
                {seatLabel(seat)}
              </th>
              {c.values.map((v, val) => {
                const m = layer[cat][seat][val];
                const w = whisperLayer[cat][seat][val];
                const mark = m === 2 ? "◯" : m === 1 ? "✕" : "";
                const wisp = w !== 0 && m === 0 ? (w === 2 ? "◯" : "✕") : "";
                return (
                  <td key={val} className="p-0.5">
                    <button
                      onClick={() => onCell(cat, seat, val)}
                      aria-label={`seat ${seat + 1}, ${v}: ${m === 2 ? "bound" : m === 1 ? "snuffed" : "unmarked"}`}
                      className="flex h-11 w-11 items-center justify-center rounded-md border text-base transition hover:border-brass focus:outline-none focus-visible:ring-2 sm:h-9 sm:w-9"
                      style={{
                        borderColor: m === 2 ? ACCENT : "var(--line,#2a2333)",
                        background: m === 2 ? `${ACCENT}26` : "transparent",
                        color: m === 2 ? ACCENT : m === 1 ? "#7a6e8a" : "transparent",
                      }}
                    >
                      <span aria-hidden>{mark || (wisp && <span className="opacity-30">{wisp}</span>) || "·"}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Banished({
  puzzle,
  seconds,
  strikes,
  copied,
  setCopied,
}: {
  puzzle: SeancePuzzle;
  seconds: number;
  strikes: number;
  copied: boolean;
  setCopied: (b: boolean) => void;
}) {
  const collected = useMemo(() => spiritsBanished(loadGrimoire()).length, []);
  const share = useMemo(() => {
    const runes = puzzle.categories
      .map(() => "🔮".repeat(puzzle.n))
      .join("\n");
    return [
      `✦ The Séance — ${puzzle.rite}`,
      `${puzzle.spirit} banished`,
      `⏱ ${fmt(seconds)}  💀 ${strikes}`,
      runes,
      `parlor · ${puzzle.date}`,
    ].join("\n");
  }, [puzzle, seconds, strikes]);

  function copy() {
    navigator.clipboard?.writeText(share).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 text-center"
    >
      <p className="microlabel tracking-widest" style={{ color: ACCENT }}>
        spirit stabilised
      </p>
      <p className="display text-3xl">{puzzle.spirit}</p>
      <p className="font-mono text-5xl tabular-nums" style={{ color: ACCENT }}>
        {fmt(seconds)}
      </p>
      <p className="text-sm text-muted">
        {strikes === 0
          ? "A flawless channelling. The Medium nods."
          : `${strikes} poltergeist strike${strikes > 1 ? "s" : ""} along the way.`}
      </p>
      <pre className="whitespace-pre-wrap text-2xl leading-snug">
        {puzzle.categories.map(() => "🔮".repeat(puzzle.n)).join("\n")}
      </pre>
      <button
        onClick={copy}
        className="rounded-full px-6 py-3 text-sm font-medium text-bg transition hover:brightness-110"
        style={{ background: ACCENT }}
      >
        {copied ? "copied ✓" : "share result"}
      </button>
      <p className="microlabel text-smoke">
        📖 grimoire — {collected} spirit{collected === 1 ? "" : "s"} banished
      </p>
    </motion.div>
  );
}
