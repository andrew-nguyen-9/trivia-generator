"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SeancePuzzle } from "@/lib/seance";
import { recordBanishing, loadGrimoire, spiritsBanished } from "@/lib/grimoire";
import { buildShare, type GameResult, type Tier } from "@/lib/share";
import { sfxGlassClink, sfxWrong, sfxPianoChord, sfxDoorLatch } from "@/lib/sound";
import styles from "./SeanceGame.module.css";

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
  const active = puzzle;

  // ── Dark state: archive-play of a date that was never generated (DB
  // connected, no row). Zero-env-var play always gets a puzzle — see
  // `getSeancePuzzle` in lib/queries.ts. ──
  if (!active) {
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

  return <SeanceTable puzzle={active} reduce={!!reduce} />;
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
  const [activeClue, setActiveClue] = useState<number | null>(null);
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

  const setLayer = whisperMode ? setWhisper : setBoard;

  // columns the selected clue names, as "cat:val" keys → highlight in the matrix.
  const hiCols = useMemo(() => {
    const s = new Set<string>();
    if (activeClue === null) return s;
    const cl = puzzle.clues[activeClue];
    if (!cl) return s;
    s.add(`${cl.a.cat}:${cl.a.val}`);
    if (cl.b) s.add(`${cl.b.cat}:${cl.b.val}`);
    return s;
  }, [activeClue, puzzle.clues]);

  const cycle = useCallback(
    (c: number, seat: number, val: number) => {
      if (won) return;
      const wasEmpty = board[c][seat][val] === 0;
      setLayer((prev) => {
        const next = prev.map((cat) => cat.map((row) => row.slice()));
        const cur = next[c][seat][val];
        const nv: Mark = ((cur + 1) % 3) as Mark;
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
      // glass clink when a fresh cell is bound (empty → bind needs two taps; the
      // snuff→bind transition is the one that lands on confirm).
      if (!whisperMode && !wasEmpty && (board[c][seat][val] + 1) % 3 === 2) {
        sfxGlassClink();
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
    return (
      <Banished
        puzzle={puzzle}
        seconds={total}
        strikes={strikes}
        copied={copied}
        setCopied={setCopied}
      />
    );
  }

  return (
    <motion.div
      className={styles.shell}
      animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        // edges darken as the séance drags on
        boxShadow: `inset 0 0 140px ${pressure * 100}px rgba(8,4,14,${pressure})`,
      }}
    >
      {/* HUD */}
      <div className={styles.hud}>
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

      <div className={styles.main}>
        {/* Clues — the corrupted message. Tap one to light up the cells it names. */}
        <div>
          <p className="microlabel mb-2 text-smoke">
            the spirit whispers ({puzzle.clues.length}) · tap to trace
          </p>
          <div className={styles.clues}>
            {puzzle.clues.map((cl, i) => {
              const on = activeClue === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveClue(on ? null : i)}
                  aria-pressed={on}
                  className={`${styles.clue} ${on ? styles.clueActive : ""} text-sm text-ink`}
                  style={on ? { color: ACCENT } : undefined}
                >
                  <span className="text-smoke select-none" aria-hidden>
                    ✦
                  </span>
                  <span>{cl.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The Scrying Matrix — one unified seat × (category·value) grid. */}
        <div className={styles.matrixWrap}>
          <table className={styles.matrix} role="grid" aria-label="the scrying matrix">
            <thead>
              <tr>
                <td className={styles.corner} aria-hidden />
                {puzzle.categories.map((cat, c) => (
                  <th
                    key={cat.key}
                    colSpan={puzzle.n}
                    scope="colgroup"
                    className={`${styles.catBand} ${c > 0 ? styles.groupStart : ""}`}
                    style={{ color: ACCENT }}
                  >
                    {cat.label}
                  </th>
                ))}
              </tr>
              <tr>
                <td className={styles.corner}>seat</td>
                {puzzle.categories.map((cat, c) =>
                  cat.values.map((v, val) => {
                    const hi = hiCols.has(`${c}:${val}`);
                    return (
                      <th
                        key={`${cat.key}-${val}`}
                        scope="col"
                        className={`${styles.valHead} ${val === 0 && c > 0 ? styles.groupStart : ""} ${hi ? styles.colHiHead : ""} text-muted`}
                        title={v}
                      >
                        <span>{v}</span>
                      </th>
                    );
                  }),
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: puzzle.n }, (_, seat) => (
                <tr key={seat}>
                  <th scope="row" className={`${styles.seatHead} text-smoke`}>
                    {seat + 1}
                  </th>
                  {puzzle.categories.map((cat, c) =>
                    cat.values.map((v, val) => {
                      const m = board[c][seat][val];
                      const w = whisper[c][seat][val];
                      const mark = m === 2 ? "◯" : m === 1 ? "✕" : "";
                      const wisp = w !== 0 && m === 0 ? (w === 2 ? "◯" : "✕") : "";
                      const hi = hiCols.has(`${c}:${val}`);
                      return (
                        <td
                          key={`${cat.key}-${val}`}
                          className={`${styles.cellTd} ${val === 0 && c > 0 ? styles.groupStart : ""} ${hi ? styles.colHi : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => cycle(c, seat, val)}
                            aria-label={`seat ${seat + 1}, ${cat.label} ${v}: ${m === 2 ? "bound" : m === 1 ? "snuffed" : "unmarked"}`}
                            className={styles.cell}
                            style={{
                              borderColor: m === 2 ? ACCENT : undefined,
                              background: m === 2 ? `${ACCENT}26` : "transparent",
                              color: m === 2 ? ACCENT : m === 1 ? "#7a6e8a" : "transparent",
                            }}
                          >
                            <span aria-hidden>
                              {mark || (wisp && <span className="opacity-30">{wisp}</span>) || "·"}
                            </span>
                          </button>
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.nav}>
        <div className="flex items-center gap-2">
          {puzzle.whisper && (
            <>
              <button
                onClick={() => {
                  setWhisperMode((wm) => !wm);
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

      <p className="text-center microlabel text-smoke">
        tap once to snuff (✕) · tap twice to bind (◯) · a wrong submission costs +60s
        {puzzle.whisper ? " · whisper mode is a scratchpad" : ""}
      </p>
    </motion.div>
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

  // §3.7 social artifact: solve time + the solved grid, through the §3.0 share
  // seam. One 🟩 tier per binding (cat × seat); a clean solve is an all-green
  // board shaped K rows × N. Time/strikes ride in the headline composed over
  // card.grid/card.url — the Mystery pattern (no `score`, so the OG card shows
  // the grid + date without a misleading numeric).
  const { grid, text } = useMemo(() => {
    const tiers: Tier[] = Array(puzzle.categories.length * puzzle.n).fill("hit");
    const card = buildShare({
      room: "/seance",
      date: puzzle.date,
      tiers,
      columns: puzzle.n,
    } satisfies GameResult);
    return {
      grid: card.grid,
      text: [
        `✦ The Séance — ${puzzle.rite}`,
        `${puzzle.spirit} banished`,
        `⏱ ${fmt(seconds)}  💀 ${strikes}`,
        card.grid,
        card.url,
      ].join("\n"),
    };
  }, [puzzle, seconds, strikes]);

  function copy() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        void navigator.share({ text }).catch(() => {});
      } else {
        void navigator.clipboard?.writeText(text);
      }
    } catch {
      /* clipboard/share unavailable — silently no-op */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <pre className="whitespace-pre-wrap text-2xl leading-snug">{grid}</pre>
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
