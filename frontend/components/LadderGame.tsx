"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pickRotating } from "@/lib/rng";
import { CATEGORY_HEX, type LadderCandidate, type Question } from "@/lib/types";
import { sfxCorrect, sfxWrong, sfxPianoChord } from "@/lib/sound";
import Confetti from "@/components/Confetti";

const ROUND_COUNT = 5;
const MAX_ATTEMPTS = 3;

interface LadderRound {
  question: Question;
  guesses: string[];      // candidate labels guessed so far
  state: "active" | "correct" | "exhausted";
  attemptsUsed: number;
}

// Client-side distance: lower = more similar
// 2·(category≠) + 1·(region≠) + min(1, |Δmagnitude|)
function candidateDist(
  target: { category: string; region?: string | null },
  candidate: LadderCandidate,
  targetMagnitude: number,
): number {
  let d = 0;
  if (target.category !== candidate.category) d += 2;
  if (target.region && candidate.region && target.region !== candidate.region) d += 1;
  d += Math.min(1, Math.abs(targetMagnitude - candidate.magnitude));
  return d;
}

function hints(
  target: { category: string; region?: string | null },
  candidate: LadderCandidate,
  targetMagnitude: number,
): string[] {
  const h: string[] = [];
  if (target.category === candidate.category) h.push("same category");
  if (target.region && candidate.region) {
    h.push(target.region === candidate.region ? "same region" : "different region");
  }
  const delta = Math.abs(targetMagnitude - candidate.magnitude);
  if (delta < 0.1) h.push("magnitude: very close");
  else if (delta < 0.3) h.push("magnitude: close");
  else if (delta < 0.6) h.push("magnitude: off");
  else h.push("magnitude: far");
  return h;
}

export default function LadderGame({ pool }: { pool: Question[] }) {
  const questions = useMemo(() => pickRotating(pool, ROUND_COUNT), [pool]);

  const [rounds, setRounds] = useState<LadderRound[]>(
    questions.map((q) => ({ question: q, guesses: [], state: "active", attemptsUsed: 0 })),
  );
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  if (pool.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">🪜</p>
        <p className="text-muted">The ladder is not yet built.</p>
        <p className="microlabel">check back once the nightly forge runs</p>
      </div>
    );
  }

  const round = rounds[current];
  const q = round?.question;
  const candidates = q?.candidates ?? [];
  const hex = q ? CATEGORY_HEX[q.category] : "#b8902e";

  // Derive target magnitude from correct candidate
  const correctCand = candidates.find((c) => c.label === q?.correct);
  const targetMag = correctCand?.magnitude ?? 0;

  // Sort remaining candidates by ascending distance to help with hint coloring
  const remaining = candidates.filter((c) => !round.guesses.includes(c.label));

  function pickCandidate(label: string) {
    if (!round || round.state !== "active") return;
    const isCorrect = label === q.correct;
    isCorrect ? sfxCorrect() : sfxWrong();

    const newGuesses = [...round.guesses, label];
    const attemptsUsed = newGuesses.length;
    const newState: LadderRound["state"] =
      isCorrect ? "correct" : attemptsUsed >= MAX_ATTEMPTS ? "exhausted" : "active";

    setRounds((prev) =>
      prev.map((r, i) => (i === current ? { ...r, guesses: newGuesses, state: newState, attemptsUsed } : r)),
    );

    if (newState !== "active") {
      if (isCorrect && rounds.filter((r) => r.state === "correct").length + 1 === ROUND_COUNT) {
        setShowConfetti(true);
      }
      setTimeout(() => advance(), 1600);
    }
  }

  function advance() {
    if (current + 1 >= ROUND_COUNT) {
      sfxPianoChord();
      setDone(true);
    } else {
      setCurrent((c) => c + 1);
    }
  }

  const score = rounds.filter((r) => r.state === "correct").length;

  if (done) {
    return (
      <>
        <Confetti active={score >= ROUND_COUNT * 0.6} />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center"
        >
          <p className="microlabel tracking-widest text-brass">ladder complete</p>
          <p className="display text-7xl" style={{ color: hex }}>
            {score}<span className="text-4xl text-muted">/{ROUND_COUNT}</span>
          </p>
          <p className="text-sm text-muted">
            {score === ROUND_COUNT
              ? "Every rung. The house bows."
              : score >= 3
              ? "Most rungs climbed. Respectable."
              : "The ladder stood. You wobbled."}
          </p>
          <div className="flex gap-2 mt-2">
            {rounds.map((r, i) => (
              <span key={i}>
                {r.state === "correct" ? "🟩" : "🟥"}
              </span>
            ))}
          </div>
          <p className="microlabel mt-1 text-smoke">
            ✦ parlor · the ladder ·{" "}
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </motion.div>
      </>
    );
  }

  const isResolved = round.state !== "active";
  const attemptsLeft = MAX_ATTEMPTS - round.guesses.length;

  return (
    <div className="mx-auto max-w-2xl">
      <Confetti active={showConfetti} />

      {/* Progress + attempts */}
      <div className="mb-6 flex items-center justify-between">
        <span className="microlabel">{current + 1} / {ROUND_COUNT}</span>
        <span className="microlabel" style={{ color: hex }}>
          {attemptsLeft > 0 && !isResolved ? `${attemptsLeft} guess${attemptsLeft !== 1 ? "es" : ""} left` : ""}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
        >
          {/* Target prompt */}
          <div
            className="mb-6 rounded-2xl border border-line bg-surface p-5"
            style={{ boxShadow: `0 0 40px ${hex}14` }}
          >
            <span className="microlabel mb-2 block" style={{ color: hex }}>
              find the closest match
            </span>
            <p className="text-lg font-medium text-ink">{q.prompt}</p>
          </div>

          {/* Candidate grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {candidates.map((cand) => {
              const guessIdx = round.guesses.indexOf(cand.label);
              const wasGuessed = guessIdx !== -1;
              const isCorrectGuess = cand.label === q.correct;
              const showHints = wasGuessed && !isCorrectGuess;
              const candHints = showHints
                ? hints({ category: q.category, region: correctCand?.region }, cand, targetMag)
                : [];
              const isWinner = isResolved && isCorrectGuess;

              return (
                <motion.button
                  key={cand.label}
                  disabled={wasGuessed || isResolved}
                  onClick={() => pickCandidate(cand.label)}
                  className="group relative rounded-xl border p-4 text-left transition"
                  style={{
                    borderColor: isWinner
                      ? "#2d9155"
                      : wasGuessed && !isCorrectGuess
                      ? "#b22b2b"
                      : undefined,
                    background: isWinner
                      ? "#2d915518"
                      : wasGuessed && !isCorrectGuess
                      ? "#b22b2b18"
                      : undefined,
                  }}
                  animate={isWinner ? { scale: [1, 1.04, 1] } : {}}
                  whileHover={!wasGuessed && !isResolved ? { scale: 1.02 } : {}}
                >
                  <span className="block text-sm font-medium text-ink">{cand.label}</span>
                  {cand.region && (
                    <span className="block text-xs text-muted mt-0.5">{cand.region}</span>
                  )}

                  {/* Hint chips on wrong guess */}
                  {showHints && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {candHints.map((h, j) => (
                        <span
                          key={j}
                          className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  {isWinner && (
                    <span className="absolute right-3 top-3 text-sm" style={{ color: "#2d9155" }}>
                      ✓
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Reveal on exhausted */}
          {round.state === "exhausted" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-xl border border-line bg-surface/60 px-4 py-3 text-center"
            >
              <p className="text-xs text-muted mb-1">the answer was</p>
              <p className="font-medium text-ink">{q.correct}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
