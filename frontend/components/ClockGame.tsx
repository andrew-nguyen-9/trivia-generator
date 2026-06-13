"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CATEGORY_HEX, CATEGORY_LABEL, type Question } from "@/lib/types";
import { usePractice } from "@/lib/usePractice";
import PracticeBar from "@/components/PracticeBar";
import { shuffled } from "@/lib/rng";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import Confetti from "@/components/Confetti";
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";

const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear();
const HINT_CAP = 80; // max points when hint is used

const pointsFor = (guess: number, truth: number, hintUsed: boolean) =>
  Math.min(
    hintUsed ? HINT_CAP : 100,
    Math.max(0, 100 - 2 * Math.abs(guess - truth)),
  );

export default function ClockGame({
  rounds: initialRounds,
  pool,
}: {
  rounds: Question[];
  pool?: Question[];
}) {
  const reduced = useReducedMotion();
  const { practiceMode, togglePractice, saved, saveQ, removeQ, isSaved } = usePractice();
  const { record } = useProfile();

  const [rounds, setRounds] = useState(initialRounds);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState(1970);
  const [locked, setLocked] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const recorded = useRef(false);

  useEffect(() => {
    if (!done || recorded.current) return;
    recorded.current = true;
    const win = score >= rounds.length * 60;
    if (win) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({ room: "clock", score, xp: score });
    if (unlocked.length) setToasts(unlocked);
  }, [done, score, rounds.length, record]);

  if (rounds.length === 0) {
    return (
      <p className="text-muted">The bank is still warming up — no dated facts yet.</p>
    );
  }

  const q = rounds[i];
  const truth = q.year ?? Number(q.correct);
  const pts = pointsFor(guess, truth, hintUsed);
  const decade = Math.floor(truth / 10) * 10;

  function showHint() {
    setHintUsed(true);
  }

  function lock() {
    setLocked(true);
    setScore((s) => s + pts);
    if (pts >= 80) {
      sfx.correct();
      haptic.correct();
    } else if (pts >= 40) {
      sfx.select();
    } else {
      sfx.wrong();
    }
  }

  function next() {
    if (i + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setGuess(1970);
    setLocked(false);
    setHintUsed(false);
  }

  function restart(newRounds?: Question[]) {
    const r = newRounds ?? rounds;
    setRounds(r);
    setI(0);
    setGuess(1970);
    setLocked(false);
    setHintUsed(false);
    setScore(0);
    setDone(false);
    recorded.current = false;
  }

  if (done) {
    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="microlabel">final score</p>
          <p className="display tabular text-8xl text-music">{score}</p>
          <p className="mt-2 text-muted">out of {rounds.length * 100}</p>
          <LeaderboardPanel room="clock" score={score} accent="music" />
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => restart()}
              className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
            >
              rewind the clock
            </button>
            {practiceMode && pool && pool.length > 5 && (
              <button
                onClick={() => {
                  const fresh = shuffled([...pool], () => Math.random()).slice(0, 5);
                  restart(fresh);
                }}
                className="microlabel rounded-full border border-wildcard px-6 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
              >
                ↻ new round
              </button>
            )}
          </div>
        </div>
        <PracticeBar
          practiceMode={practiceMode}
          onToggle={togglePractice}
          saved={saved}
          onRemove={removeQ}
        />
      </>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Clock</h1>
        <div className="text-right">
          <div className="microlabel">
            round {i + 1}/{rounds.length} · score
          </div>
          <div className="tabular text-3xl font-black text-music">{score}</div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <span className="microlabel" style={{ color: CATEGORY_HEX[q.category] }}>
          {CATEGORY_LABEL[q.category]}
        </span>
        <p className="display mt-3 text-2xl leading-tight sm:text-3xl">{q.prompt}</p>

        {/* Hint display */}
        {hintUsed && !locked && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 rounded-lg border border-history/40 bg-history/10 px-4 py-2"
          >
            <span className="text-history">🔍</span>
            <span className="microlabel text-history">
              This happened in the {decade}s
            </span>
            <span className="microlabel ml-auto text-muted">max {HINT_CAP} pts</span>
          </motion.div>
        )}
      </div>

      <div className="mt-10 text-center">
        <div className="microlabel">{locked ? "the truth" : "your guess"}</div>
        <motion.div
          key={locked ? "truth" : guess}
          initial={reduced || !locked ? {} : { scale: 1.25 }}
          animate={{ scale: 1 }}
          className="display tabular text-[clamp(4rem,16vw,9rem)]"
          style={{ color: locked ? CATEGORY_HEX[q.category] : undefined }}
        >
          {locked ? truth : guess}
        </motion.div>

        {!locked ? (
          <>
            <input
              type="range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={guess}
              onChange={(e) => setGuess(Number(e.target.value))}
              className="mt-6 w-full accent-[#ff4fa3]"
              aria-label="year guess"
            />
            <div className="microlabel mt-1 flex justify-between">
              <span>{MIN_YEAR}</span>
              <span>{MAX_YEAR}</span>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {!hintUsed && (
                <button
                  onClick={showHint}
                  className="microlabel rounded-full border border-history px-6 py-3 text-history transition hover:bg-history/10"
                >
                  🔍 show decade (−20 max pts)
                </button>
              )}
              <button
                onClick={lock}
                className="microlabel rounded-full border border-music px-8 py-3 text-music transition hover:bg-music hover:text-bg"
              >
                lock it in
              </button>
            </div>
          </>
        ) : (
          <div className="mt-6">
            <p className="text-muted">
              you said{" "}
              <span className="tabular font-black text-ink">{guess}</span> — off
              by{" "}
              <span className="tabular font-black text-ink">
                {Math.abs(guess - truth)}
              </span>{" "}
              {Math.abs(guess - truth) === 1 ? "year" : "years"}
              {hintUsed && (
                <span className="text-history"> (hint used, capped at {HINT_CAP})</span>
              )}
            </p>
            <p className="mt-2 text-2xl font-black text-music">+{pts} pts</p>
            {q.source_url && (
              <a
                href={q.source_url}
                target="_blank"
                rel="noreferrer"
                className="microlabel underline"
              >
                source
              </a>
            )}
            {practiceMode && (
              <div className="mt-3">
                <button
                  onClick={() => (isSaved(q) ? removeQ(q.prompt) : saveQ(q))}
                  className={`microlabel rounded-full border px-4 py-2 transition ${
                    isSaved(q)
                      ? "border-history text-history"
                      : "border-line text-muted hover:border-history hover:text-history"
                  }`}
                >
                  {isSaved(q) ? "★ saved" : "☆ save question"}
                </button>
              </div>
            )}
            <div>
              <button
                onClick={next}
                className="microlabel mt-6 rounded-full border border-ink px-8 py-3 transition hover:bg-ink hover:text-bg"
              >
                {i + 1 >= rounds.length ? "finish" : "next →"}
              </button>
            </div>
          </div>
        )}
      </div>

      <PracticeBar
        practiceMode={practiceMode}
        onToggle={togglePractice}
        saved={saved}
        onRemove={removeQ}
      />
    </div>
  );
}
