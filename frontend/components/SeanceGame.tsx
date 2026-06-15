"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pickRotating } from "@/lib/rng";
import { CATEGORY_HEX, type Question } from "@/lib/types";
import { sfxCorrect, sfxWrong, sfxPianoChord, sfxGlassClink } from "@/lib/sound";

const ROUND_COUNT = 5;

interface SeanceRound {
  question: Question;
  cluesRevealed: number;
  state: "active" | "correct" | "wrong" | "skipped";
  pointsEarned: number;
}

// Points: 4 clues → 4/3/2/1 pts (earlier = more)
function pointsForClue(cluesRevealed: number): number {
  return Math.max(1, 5 - cluesRevealed);
}

export default function SeanceGame({ pool }: { pool: Question[] }) {
  const questions = useMemo(() => pickRotating(pool, ROUND_COUNT), [pool]);

  const [rounds, setRounds] = useState<SeanceRound[]>(
    questions.map((q) => ({
      question: q,
      cluesRevealed: 1,
      state: "active",
      pointsEarned: 0,
    })),
  );
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);

  if (pool.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">🕯️</p>
        <p className="text-muted">The spirits are not yet here.</p>
        <p className="microlabel">the séance opens once the nightly forge runs</p>
      </div>
    );
  }

  const round = rounds[current];
  const clues = round?.question.clues ?? [];
  const visibleClues = clues.slice(0, round?.cluesRevealed ?? 1);
  const hex = round ? CATEGORY_HEX[round.question.category] : "#7040a8";

  function revealNext() {
    if (!round || round.state !== "active") return;
    const maxClues = (round.question.clues ?? []).length;
    if (round.cluesRevealed >= maxClues) return;
    sfxGlassClink();
    setRounds((prev) =>
      prev.map((r, i) =>
        i === current ? { ...r, cluesRevealed: r.cluesRevealed + 1 } : r,
      ),
    );
  }

  function handleGuess() {
    if (!round || round.state !== "active") return;
    const guess = input.trim().toLowerCase();
    const answer = round.question.correct.toLowerCase();
    const isCorrect =
      guess === answer ||
      answer.includes(guess) ||
      guess.includes(answer.split(" ")[0]);

    const pts = isCorrect ? pointsForClue(round.cluesRevealed) : 0;
    const newState = isCorrect ? "correct" : "wrong";
    isCorrect ? sfxCorrect() : sfxWrong();

    setRounds((prev) =>
      prev.map((r, i) =>
        i === current ? { ...r, state: newState, pointsEarned: pts } : r,
      ),
    );
    setInput("");

    setTimeout(() => advance(), 1400);
  }

  function skip() {
    if (!round || round.state !== "active") return;
    sfxWrong();
    setRounds((prev) =>
      prev.map((r, i) =>
        i === current ? { ...r, state: "skipped", pointsEarned: 0 } : r,
      ),
    );
    setTimeout(() => advance(), 900);
  }

  function advance() {
    if (current + 1 >= ROUND_COUNT) {
      sfxPianoChord();
      setDone(true);
    } else {
      setCurrent((c) => c + 1);
      setInput("");
    }
  }

  const totalScore = rounds.reduce((s, r) => s + r.pointsEarned, 0);
  const maxScore = ROUND_COUNT * 4;

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center"
      >
        <p className="microlabel tracking-widest text-brass">séance complete</p>
        <p className="display text-7xl" style={{ color: "#7040a8" }}>
          {totalScore}<span className="text-4xl text-muted">/{maxScore}</span>
        </p>
        <p className="text-sm text-muted max-w-sm">
          {totalScore >= maxScore * 0.75
            ? "The spirits spoke clearly. You listened."
            : totalScore >= maxScore * 0.4
            ? "Some truths revealed, others stayed veiled."
            : "The veil held. Come back to the table."}
        </p>
        <div className="flex gap-2 mt-2">
          {rounds.map((r, i) => (
            <span key={i} title={r.question.correct}>
              {r.state === "correct" ? "🟩" : r.state === "wrong" ? "🟨" : "🟥"}
            </span>
          ))}
        </div>
        <p className="microlabel mt-1 text-smoke">
          ✦ parlor · the séance ·{" "}
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </motion.div>
    );
  }

  const isRevealing = round?.state === "correct" || round?.state === "wrong" || round?.state === "skipped";

  return (
    <div className="mx-auto max-w-xl">
      {/* Progress */}
      <div className="mb-8 flex items-center justify-between">
        <span className="microlabel">{current + 1} / {ROUND_COUNT}</span>
        <span className="microlabel" style={{ color: "#b8902e" }}>
          {totalScore} pts
        </span>
      </div>

      {/* Séance card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
          style={{ boxShadow: `0 0 60px ${hex}18` }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="microlabel" style={{ color: hex }}>
              {round.question.category}
            </span>
            <span className="microlabel text-smoke">
              clue {round.cluesRevealed} / {clues.length}
            </span>
          </div>

          {/* Clue stack */}
          <div className="space-y-3 min-h-[8rem]">
            {visibleClues.map((clue, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i === visibleClues.length - 1 ? 0.1 : 0 }}
                className="rounded-xl border border-line bg-bg/60 px-4 py-3 text-sm text-ink"
                style={{ opacity: i === visibleClues.length - 1 ? 1 : 0.55 }}
              >
                {i + 1}. {clue}
              </motion.div>
            ))}
          </div>

          {/* Reveal more / answer */}
          {!isRevealing && (
            <div className="mt-6 space-y-3">
              {round.cluesRevealed < clues.length && (
                <button
                  onClick={revealNext}
                  className="microlabel w-full rounded-xl border border-line bg-bg/40 py-2.5 transition hover:border-brass"
                  style={{ color: "#b8902e" }}
                >
                  ✦ reveal next clue ({pointsForClue(round.cluesRevealed + 1)} pts)
                </button>
              )}
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                  placeholder="your answer…"
                  autoFocus
                  className="flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-muted focus:border-brass focus:outline-none"
                />
                <button
                  onClick={handleGuess}
                  disabled={!input.trim()}
                  className="microlabel rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-brass disabled:opacity-40"
                  style={{ color: hex }}
                >
                  →
                </button>
              </div>
              <button onClick={skip} className="microlabel text-smoke hover:text-muted transition w-full text-center">
                pass
              </button>
            </div>
          )}

          {/* Result reveal */}
          {isRevealing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 rounded-xl border px-4 py-3 text-center"
              style={{
                borderColor: round.state === "correct" ? "#2d9155" : "#b22b2b",
                background: round.state === "correct" ? "#2d915520" : "#b22b2b20",
              }}
            >
              <p className="text-xs uppercase tracking-widest text-muted mb-1">
                {round.state === "correct"
                  ? `+${round.pointsEarned} pts`
                  : round.state === "skipped"
                  ? "passed"
                  : "wrong"}
              </p>
              <p className="font-medium text-ink">{round.question.correct}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Candle decoration */}
      <div className="mt-8 flex justify-center gap-6 text-2xl opacity-20" aria-hidden>
        <span className="animate-flicker">🕯️</span>
        <span className="animate-flicker" style={{ animationDelay: "0.7s" }}>🕯️</span>
        <span className="animate-flicker" style={{ animationDelay: "1.4s" }}>🕯️</span>
      </div>
    </div>
  );
}
