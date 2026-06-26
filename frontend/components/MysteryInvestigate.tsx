"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sfxCorrect, sfxGlassClink, sfxPianoChord, sfxWrong } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { deductionMatrix, HOURS, ROOMS, pretty, type MysteryCase } from "@/lib/mystery";
import { score, type MysteryAttempt, type MysteryScoreResult } from "@/lib/mysteryScore";
import MysteryAccusationForm from "./MysteryAccusationForm";
import MysteryStatusPill, { nextTag, type SuspectTag } from "./MysteryStatusPill";
import AchievementToast from "./AchievementToast";
import styles from "./Mystery.module.css";

export interface StoredMysteryAttempt {
  attempt: MysteryAttempt;
  result: MysteryScoreResult;
  at: number;
}

// Stable tint per room so the alibi grid is scannable — same room, same colour.
// Deliberately UNLABELLED: the tint is a grouping aid, not a solution legend.
// What it MEANS (corroboration = innocence) must be earned by spending clue 5/6.
const ROOM_TINT = [
  "bg-[#3a2a1a] text-amber-100",
  "bg-[#1f2e2a] text-emerald-100",
  "bg-[#2a1f33] text-violet-100",
  "bg-[#33231f] text-rose-100",
  "bg-[#1f2733] text-sky-100",
  "bg-[#2e2a1a] text-yellow-100",
];

const shortRoom = (r: string) => r.replace(/^the /, "");
const displayRoom = (r: string) => r.replace(/^the /, "The ");

type Step = 1 | 2 | 3;
const STEP_LABEL: Record<Step, string> = { 1: "Evidence", 2: "Alibis", 3: "Accusation" };
const STEP_ROMAN: Record<Step, string> = { 1: "I", 2: "II", 3: "III" };
const CLUE_COST = 80; // mirrors lib/mysteryScore CLUE_PENALTY for the reveal label

export default function MysteryInvestigate({
  mystery,
  onSolved,
}: {
  mystery: MysteryCase;
  onSolved: (stored: StoredMysteryAttempt) => void;
}) {
  const { record } = useProfile();
  const [step, setStep] = useState<Step>(1);
  const [cluesRevealed, setCluesRevealed] = useState(1);
  const [tags, setTags] = useState<Record<string, SuspectTag>>({});
  const [whereGuess, setWhereGuess] = useState<string | null>(null);
  const [whenGuess, setWhenGuess] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const startedAt = useRef(Date.now());

  const whoGuess = useMemo(
    () => mystery.suspects.filter((s) => tags[s.id] === "prime").map((s) => s.id),
    [mystery.suspects, tags],
  );

  // The running room×hour elimination, derived purely from the clues revealed.
  // No gold "here's the answer" telegraph any more — the player reads the one
  // surviving cell themselves. That is the weaker-hint / harder-logic mandate.
  const matrix = useMemo(() => deductionMatrix(mystery, cluesRevealed), [mystery, cluesRevealed]);

  const tintFor = (room: string) => ROOM_TINT[ROOMS.indexOf(room as (typeof ROOMS)[number]) % ROOM_TINT.length];

  function cycleTag(id: string) {
    setTags((t) => ({ ...t, [id]: nextTag(t[id]) }));
    sfxGlassClink();
  }
  function revealNext() {
    setCluesRevealed((r) => Math.min(mystery.clues.length, r + 1));
    sfxPianoChord();
  }
  function relationshipToVictim(id: string): string {
    const edge = mystery.dossiers[id]?.relationships.find((r) => r.to === mystery.victim.id);
    return edge ? edge.kind : "no known tie to the victim";
  }

  function submit() {
    const elapsedSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    const attempt: MysteryAttempt = {
      whoGuess,
      whereGuess,
      whenGuess,
      cluesRevealed,
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
    <div className={`${styles.shell} px-4 pb-6`}>
      {/* ── Case bar: identity + step pips (pips double as nav) ──────────────── */}
      <header className={styles.caseBar}>
        <div className="min-w-0">
          <p className="microlabel text-brass">
            <span aria-hidden className="mr-2 text-gold/70">𓂀</span>case #{mystery.caseNumber}
          </p>
          <h2 className="display gilt mt-0.5 truncate text-2xl sm:text-3xl">{mystery.title}</h2>
        </div>
        <ol className={styles.pips} aria-label="investigation steps">
          {([1, 2, 3] as Step[]).map((n) => {
            const active = step === n;
            return (
              <li key={n}>
                <button
                  onClick={() => setStep(n)}
                  aria-current={active ? "step" : undefined}
                  className={`${styles.pip} ${active ? `${styles.pipActive} border-gold` : "border-line"}`}
                >
                  <span className={`display text-base ${active ? "gilt" : "text-muted"}`}>{STEP_ROMAN[n]}</span>
                  <span className={`microlabel text-[9px] ${active ? "text-gold" : "text-muted"}`}>
                    {STEP_LABEL[n]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      {/* ── Active step ─────────────────────────────────────────────────────── */}
      <div className={styles.body}>
        {step === 1 && (
          <StepPanel title="The Evidence Ledger" hint="Reveal only what you must — every clue spent costs points.">
            <div className={styles.evidence}>
              {/* Clue ledger */}
              <div>
                <p className="mb-3 text-sm leading-relaxed text-ink/80">{mystery.opening}</p>
                <div className={styles.ledger}>
                  <AnimatePresence initial={false}>
                    {mystery.clues.slice(0, cluesRevealed).map((clue) => (
                      <motion.div
                        key={clue.stage}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-line bg-bg/40 p-3"
                      >
                        <p className="microlabel text-ember">{clue.kind}</p>
                        <p className="display mt-0.5 text-base">{clue.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-ink/85">{clue.text}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {cluesRevealed < mystery.clues.length ? (
                    <button
                      onClick={revealNext}
                      className="microlabel rounded-full border border-line px-4 py-2 text-muted transition hover:border-gold hover:text-gold"
                    >
                      ✦ reveal next clue (−{CLUE_COST})
                    </button>
                  ) : (
                    <span className="microlabel text-muted">every clue is on the table</span>
                  )}
                  <span className="microlabel text-muted">{cluesRevealed}/{mystery.clues.length} revealed</span>
                </div>
              </div>

              {/* WHERE/WHEN elimination grid */}
              <div>
                <p className="microlabel mb-2 text-muted">where &amp; when — what survives</p>
                <table className={`${styles.grid} text-[11px]`}>
                  <thead>
                    <tr>
                      <th />
                      {HOURS.map((h) => (
                        <th key={h} className="font-normal text-muted">{h.replace(":00", "")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROOMS.map((room, ri) => (
                      <tr key={room}>
                        <td className={`${styles.rowHead} pr-2 text-right text-muted`}>{shortRoom(room)}</td>
                        {HOURS.map((_, hi) => {
                          const cell = matrix[ri][hi];
                          return (
                            <td key={hi}>
                              <span
                                className={`${styles.cell} ${
                                  cell === "ruled-out"
                                    ? "bg-bg/30 text-muted/25"
                                    : cell === "confirmed"
                                      ? "border border-ember/50 text-ember/80"
                                      : "border border-line/50 text-muted"
                                }`}
                              >
                                {cell === "ruled-out" ? "·" : cell === "confirmed" ? "✦" : ""}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] leading-snug text-muted">
                  Each cleared clue strikes rooms and hours from the board. When one cell stands
                  alone, that is where and when it happened.
                </p>
              </div>
            </div>
          </StepPanel>
        )}

        {step === 2 && (
          <StepPanel
            title="The Alibi Board"
            hint="Tap a name for the dossier · tap the seal to mark a suspect."
          >
            <div className={styles.boardWrap}>
              <table className={`${styles.grid} text-[11px]`}>
                <thead>
                  <tr>
                    <th className={styles.rowHead} />
                    {HOURS.map((h) => (
                      <th key={h} className="font-normal text-muted">{h.replace(":00", "")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mystery.suspects.map((s) => {
                    const open = expanded === s.id;
                    return (
                      <Fragment key={s.id}>
                        <tr>
                          <td className={styles.rowHead}>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpanded(open ? null : s.id)}
                                className="flex min-w-0 items-center gap-1.5 text-left"
                                aria-expanded={open}
                              >
                                <span className="text-lg">{s.emoji}</span>
                                <span className="truncate text-sm text-ink">{pretty(s.id)}</span>
                              </button>
                              <MysteryStatusPill tag={tags[s.id]} onCycle={() => cycleTag(s.id)} />
                            </div>
                          </td>
                          {HOURS.map((_, hi) => {
                            const room = mystery.dossiers[s.id].claimed[hi];
                            return (
                              <td key={hi}>
                                <span
                                  className={`${styles.cell} truncate px-1 ${tintFor(room)} opacity-80`}
                                  title={displayRoom(room)}
                                >
                                  {shortRoom(room)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                        <AnimatePresence initial={false}>
                          {open && (
                            <tr>
                              <td colSpan={HOURS.length + 1} className="px-0 pb-2">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="rounded-xl border border-line bg-surface/40 p-3 text-left">
                                    <p className="text-[11px] text-muted">{s.title}</p>
                                    <p className="mt-1 text-[12px] italic leading-snug text-ink/75">{s.trait}</p>
                                    <p className="mt-1 text-[11px] text-ink/60">Always carries {s.quirk}.</p>
                                    <p className="mt-1 text-[11px] text-ember/80">
                                      To the victim: {relationshipToVictim(s.id)}.
                                    </p>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted">Each guest&rsquo;s claimed room, hour by hour.</p>
            </div>
          </StepPanel>
        )}

        {step === 3 && (
          <StepPanel title="The Accusation" hint="Name the guilty, the room, and the hour.">
            <MysteryAccusationForm
              mystery={mystery}
              whoGuess={whoGuess}
              whereGuess={whereGuess}
              whenGuess={whenGuess}
              onWhereChange={setWhereGuess}
              onWhenChange={setWhenGuess}
              onSubmit={submit}
            />
          </StepPanel>
        )}
      </div>

      {/* ── Step nav ────────────────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <button
          onClick={() => setStep((s) => (Math.max(1, s - 1) as Step))}
          disabled={step === 1}
          className="microlabel rounded-full border border-line px-5 py-2 text-muted transition enabled:hover:border-gold enabled:hover:text-gold disabled:opacity-30"
        >
          ← back
        </button>
        <span className="microlabel text-muted">{STEP_ROMAN[step]} · {STEP_LABEL[step]}</span>
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => (Math.min(3, s + 1) as Step))}
            className="microlabel rounded-full border border-gold px-5 py-2 text-gold transition hover:bg-gold hover:text-bg"
          >
            next →
          </button>
        ) : (
          <span className="w-[5.5rem]" aria-hidden />
        )}
      </nav>

      <AchievementToast queue={toasts} />
    </div>
  );
}

function StepPanel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3">
        <h3 className="display text-lg text-ink">{title}</h3>
        <p className="microlabel mt-0.5 text-muted">{hint}</p>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
