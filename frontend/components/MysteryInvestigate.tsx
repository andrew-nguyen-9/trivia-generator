"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sfxCorrect, sfxGlassClink, sfxPianoChord, sfxWrong } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import {
  HOURS,
  ROOMS,
  pretty,
  deductionMatrix,
  correctEliminations,
  freeCluesEarned,
  nextCheckpoint,
  type Mark,
  type MysteryCase,
} from "@/lib/mystery";
import { score, type MysteryAttempt, type MysteryScoreResult } from "@/lib/mysteryScore";
import MysteryStatusPill, { nextTag, type SuspectTag } from "./MysteryStatusPill";
import AchievementToast from "./AchievementToast";
import styles from "./Mystery.module.css";

export interface StoredMysteryAttempt {
  attempt: MysteryAttempt;
  result: MysteryScoreResult;
  at: number;
}

// Vibrant per-room tint so the alibi grid is scannable — same room, same colour.
// Deliberately UNLABELLED: a grouping aid, not a solution legend. §5.5–5.6 want
// these brighter than the old muted browns, with near-white text.
const ROOM_TINT = [
  "bg-amber-500/35 text-amber-50",
  "bg-emerald-500/35 text-emerald-50",
  "bg-violet-500/35 text-violet-50",
  "bg-rose-500/35 text-rose-50",
  "bg-sky-500/35 text-sky-50",
  "bg-yellow-400/35 text-yellow-50",
];

const shortHour = (h: string) => h.replace(":00", "");
const displayRoom = (r: string) => r.replace(/^the /, "The ");
const CLUE_COST = 80; // mirrors lib/mysteryScore CLUE_PENALTY for the reveal label

type CellState = "open" | "out" | "accused";

export default function MysteryInvestigate({
  mystery,
  onSolved,
}: {
  mystery: MysteryCase;
  onSolved: (stored: StoredMysteryAttempt) => void;
}) {
  const { record } = useProfile();
  const [revealed, setRevealed] = useState(1);
  const [freeGiven, setFreeGiven] = useState(0);
  const [doneClues, setDoneClues] = useState<Set<number>>(new Set());
  const [tags, setTags] = useState<Record<string, SuspectTag>>({});
  const [cells, setCells] = useState<CellState[][]>(() =>
    ROOMS.map(() => HOURS.map(() => "open" as CellState)),
  );
  const [motiveGuess, setMotiveGuess] = useState<string | null>(null);
  const [weaponGuess, setWeaponGuess] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const startedAt = useRef(Date.now());

  // Player's elimination grid, in E2a's Mark vocabulary (the accused cell is not
  // an elimination, so it reads "unknown" for checkpoint accounting).
  const marks: Mark[][] = useMemo(
    () => cells.map((row) => row.map((c) => (c === "out" ? "ruled-out" : "unknown"))),
    [cells],
  );
  // Clue-derived hint layer: which room/hour the revealed clues have struck out.
  const clueMatrix = useMemo(() => deductionMatrix(mystery, revealed), [mystery, revealed]);

  const accused = useMemo(() => {
    for (let r = 0; r < cells.length; r++)
      for (let h = 0; h < cells[r].length; h++) if (cells[r][h] === "accused") return { r, h };
    return null;
  }, [cells]);
  const whereGuess = accused ? ROOMS[accused.r] : null;
  const whenGuess = accused ? accused.h : null;

  const whoGuess = useMemo(
    () => mystery.suspects.filter((s) => tags[s.id] === "prime").map((s) => s.id),
    [mystery.suspects, tags],
  );

  const correctElim = correctEliminations(mystery, marks);
  const freeEarned = freeCluesEarned(mystery, marks);
  const toNextClue = nextCheckpoint(mystery, marks);

  // Checkpoint reward (§5.11–5.12): each earned free clue surfaces the next clue
  // at no point cost. freeGiven tracks grants so penalty only counts paid reveals.
  useEffect(() => {
    const grant = Math.min(freeEarned - freeGiven, mystery.clues.length - revealed);
    if (grant > 0) {
      setRevealed((r) => r + grant);
      setFreeGiven((g) => g + grant);
      sfxPianoChord();
    }
  }, [freeEarned, freeGiven, revealed, mystery.clues.length]);

  const paidClues = Math.max(0, revealed - 1 - freeGiven);

  function cycleCell(r: number, h: number) {
    setCells((prev) => {
      const next = prev.map((row) => row.slice());
      const cur = next[r][h];
      if (cur === "open") next[r][h] = "out";
      else if (cur === "out") {
        for (let i = 0; i < next.length; i++)
          for (let j = 0; j < next[i].length; j++) if (next[i][j] === "accused") next[i][j] = "open";
        next[r][h] = "accused";
      } else next[r][h] = "open";
      return next;
    });
    sfxGlassClink();
  }

  function cycleTag(id: string) {
    setTags((t) => ({ ...t, [id]: nextTag(t[id]) }));
    sfxGlassClink();
  }
  function toggleDone(stage: number) {
    setDoneClues((d) => {
      const next = new Set(d);
      next.has(stage) ? next.delete(stage) : next.add(stage);
      return next;
    });
    haptic.tap();
  }
  function revealNext() {
    setRevealed((r) => Math.min(mystery.clues.length, r + 1));
    sfxPianoChord();
  }
  function relationshipToVictim(id: string): string {
    const edge = mystery.dossiers[id]?.relationships.find((r) => r.to === mystery.victim.id);
    return edge ? edge.kind : "no known tie to the victim";
  }

  const canSubmit =
    whoGuess.length > 0 &&
    whereGuess !== null &&
    whenGuess !== null &&
    motiveGuess !== null &&
    weaponGuess !== null;

  function submit() {
    if (!canSubmit) return;
    const elapsedSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    const attempt: MysteryAttempt = {
      whoGuess,
      whereGuess,
      whenGuess,
      motiveGuess,
      weaponGuess,
      // ponytail: free checkpoint clues don't add to the paid-clue penalty.
      cluesRevealed: 1 + paidClues,
      elapsedSeconds,
      tableTags: tags,
      autoMarkUsed: false,
    };
    const result = score(mystery, attempt);
    if (result.won) { sfxCorrect(); haptic.win(); } else { sfxWrong(); haptic.wrong(); }
    const unlocked = record({ room: "mystery", score: result.total, correct: result.won ? 1 : 0, total: 1 });
    if (unlocked.length) setToasts(unlocked);
    onSolved({ attempt, result, at: Date.now() });
  }

  return (
    <div className={`${styles.shell} px-3 pb-6 sm:px-4`}>
      {/* ── Case bar ─────────────────────────────────────────────────────────── */}
      <header className={styles.caseBar}>
        <div className="min-w-0">
          <p className="microlabel text-brass">
            <span aria-hidden className="mr-2 text-gold/70">𓂀</span>case #{mystery.caseNumber}
          </p>
          <h2 className="display gilt mt-0.5 text-2xl leading-tight sm:text-3xl">{mystery.title}</h2>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="microlabel text-muted">cells cleared</p>
            <p className="display tabular text-lg text-ink">{correctElim}</p>
          </div>
          <div>
            <p className="microlabel text-muted">clues</p>
            <p className="display tabular text-lg text-ink">{revealed}/{mystery.clues.length}</p>
          </div>
        </div>
      </header>

      {/* ── Workspace: clue panel | board (independent hover-scroll) ─────────── */}
      <div className={styles.workspace}>
        {/* LEFT — clue panel */}
        <aside className={styles.cluePanel}>
          <div>
            <h3 className="display text-base text-ink">Evidence</h3>
            <p className="microlabel mt-0.5 text-muted">spend only what you must</p>
          </div>
          <div className={styles.scrollPane}>
            <p className="mb-3 text-[13px] leading-relaxed text-ink/80">{mystery.opening}</p>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {mystery.clues.slice(0, revealed).map((clue) => {
                  const done = doneClues.has(clue.stage);
                  return (
                    <motion.button
                      key={clue.stage}
                      type="button"
                      onClick={() => toggleDone(clue.stage)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      title={done ? "marked done — tap to un-grey" : "tap when you've used this clue"}
                      className={`rounded-xl border p-3 text-left transition ${
                        done
                          ? "border-line/60 bg-bg/20 opacity-45"
                          : "border-line bg-bg/40 hover:border-gold/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="microlabel text-ember">{clue.kind}</p>
                        <span className="microlabel text-[9px] text-muted">{done ? "✓ done" : ""}</span>
                      </div>
                      <p className={`display mt-0.5 text-[15px] ${done ? "line-through" : ""}`}>{clue.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink/85">{clue.text}</p>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
          {/* reveal + checkpoint progress */}
          <div className="mt-1 space-y-2 border-t border-line pt-3">
            {revealed < mystery.clues.length ? (
              <button
                onClick={revealNext}
                className="microlabel w-full rounded-full border border-line px-4 py-2 text-muted transition hover:border-gold hover:text-gold"
              >
                ✦ reveal next clue (−{CLUE_COST})
              </button>
            ) : (
              <p className="microlabel text-center text-muted">every clue is on the table</p>
            )}
            <p className="microlabel text-center text-muted">
              {toNextClue !== null && revealed < mystery.clues.length
                ? `${toNextClue} more correct eliminations earns a FREE clue`
                : freeGiven > 0
                  ? `${freeGiven} free ${freeGiven === 1 ? "clue" : "clues"} earned ✦`
                  : "clear cells to earn free clues"}
            </p>
          </div>
        </aside>

        {/* RIGHT — the board */}
        <section className={`${styles.board} ${styles.scrollPane}`}>
          {/* WHERE & WHEN deduction grid */}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="display text-base text-ink">Where &amp; When</h3>
              <p className="microlabel text-muted">
                tap a cell: rule out <span className="text-rose-300">✕</span> · name the scene{" "}
                <span className="text-gold">★</span> · clear
              </p>
            </div>
            <div className={styles.tableScroll}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.rowHead} />
                  {HOURS.map((h) => (
                    <th key={h} className="text-[11px] text-muted">{shortHour(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROOMS.map((room, ri) => (
                  <tr key={room}>
                    <td className={`${styles.rowHead} text-[12px] text-ink/80`}>{displayRoom(room)}</td>
                    {HOURS.map((_, hi) => {
                      const st = cells[ri][hi];
                      const clueOut = clueMatrix[ri][hi] === "ruled-out";
                      return (
                        <td key={hi}>
                          <button
                            type="button"
                            onClick={() => cycleCell(ri, hi)}
                            aria-label={`${displayRoom(room)} at ${HOURS[hi]}: ${st}`}
                            className={`${styles.markCell} ${
                              st === "accused"
                                ? "border-gold bg-gold/25 text-gold"
                                : st === "out"
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300/80"
                                  : clueOut
                                    ? "bg-white/[0.06] text-muted"
                                    : "text-muted"
                            }`}
                          >
                            {st === "accused" ? "★" : st === "out" ? "✕" : clueOut ? "·" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">
              The clues strike rooms and hours from the board (shown faint). Cross them out yourself to
              earn free clues, then star the one cell that survives.
            </p>
          </div>

          {/* ALIBI board */}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="display text-base text-ink">The Alibi Board</h3>
              <p className="microlabel text-muted">hover a guest for their dossier · seal to tag</p>
            </div>
            <div className={styles.tableScroll}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.rowHead} />
                  {HOURS.map((h) => (
                    <th key={h} className="text-[11px] text-muted">{shortHour(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mystery.suspects.map((s) => {
                  const open = hovered === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr>
                        <td className={styles.rowHead}>
                          <div className={`flex items-center gap-2 ${styles.suspectAnchor}`}>
                            <button
                              type="button"
                              onMouseEnter={() => setHovered(s.id)}
                              onMouseLeave={() => setHovered((h) => (h === s.id ? null : h))}
                              onClick={() => setHovered((h) => (h === s.id ? null : s.id))}
                              className="flex min-w-0 items-center gap-1.5 text-left"
                              aria-describedby={open ? `dossier-${s.id}` : undefined}
                            >
                              <span className="text-lg">{s.emoji}</span>
                              <span className="text-[12px] leading-tight text-ink">{pretty(s.id)}</span>
                            </button>
                            <MysteryStatusPill tag={tags[s.id]} onCycle={() => cycleTag(s.id)} />
                            <AnimatePresence>
                              {open && (
                                <motion.div
                                  id={`dossier-${s.id}`}
                                  role="tooltip"
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  className={styles.tooltip}
                                >
                                  <div className="rounded-xl border border-gold/40 bg-surface p-3 text-left shadow-xl">
                                    <p className="microlabel text-gold">{s.title}</p>
                                    <p className="mt-1 text-[12px] italic leading-snug text-ink/80">{s.trait}</p>
                                    <p className="mt-1 text-[11px] text-ink/65">Always carries {s.quirk}.</p>
                                    <p className="mt-1 text-[11px] text-ember/85">
                                      To the victim: {relationshipToVictim(s.id)}.
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </td>
                        {HOURS.map((_, hi) => {
                          const room = mystery.dossiers[s.id].claimed[hi];
                          const tint = ROOM_TINT[ROOMS.indexOf(room as (typeof ROOMS)[number]) % ROOM_TINT.length];
                          return (
                            <td key={hi}>
                              <span className={`${styles.cell} ${tint}`}>{displayRoom(room)}</span>
                            </td>
                          );
                        })}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              Each guest&rsquo;s claimed room, hour by hour. At the fatal hour the killer stands alone — the
              innocent always have company.
            </p>
          </div>

          {/* MOTIVE + WEAPON */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ChipPicker label="motive" pool={mystery.motivePool} value={motiveGuess} onPick={setMotiveGuess} />
            <ChipPicker label="weapon" pool={mystery.weaponPool} value={weaponGuess} onPick={setWeaponGuess} />
          </div>

          {/* ACCUSATION */}
          <div className="gilt-frame rounded-2xl bg-surface/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="microlabel text-gold">the accusation</p>
              <p className="microlabel text-muted">
                {whoGuess.length} named · {whereGuess ? displayRoom(whereGuess) : "no room"} ·{" "}
                {whenGuess !== null ? HOURS[whenGuess] : "no hour"} · {motiveGuess ?? "no motive"} ·{" "}
                {weaponGuess ?? "no weapon"}
              </p>
            </div>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="microlabel w-full rounded-full border border-ember py-3 text-ember transition enabled:hover:bg-ember enabled:hover:text-ink disabled:opacity-40"
            >
              {canSubmit ? "submit accusation" : "name a suspect, the scene, motive & weapon"}
            </button>
          </div>
        </section>
      </div>

      <AchievementToast queue={toasts} />
    </div>
  );
}

function ChipPicker({
  label,
  pool,
  value,
  onPick,
}: {
  label: string;
  pool: string[];
  value: string | null;
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <p className="microlabel mb-1.5 text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {pool.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(opt)}
              className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                on
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-line text-ink/80 hover:border-gold/40 hover:text-ink"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
