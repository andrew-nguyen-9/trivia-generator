"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CATEGORY_HEX, CATEGORY_LABEL, type Question } from "@/lib/types";

const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear();

const pointsFor = (guess: number, truth: number) =>
  Math.max(0, 100 - 2 * Math.abs(guess - truth));

export default function ClockGame({ rounds }: { rounds: Question[] }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState(1970);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (rounds.length === 0) {
    return <p className="text-muted">The bank is still warming up — no dated facts yet.</p>;
  }

  const q = rounds[i];
  const truth = q.year ?? Number(q.correct);
  const pts = pointsFor(guess, truth);

  function lock() {
    setLocked(true);
    setScore((s) => s + pts);
  }

  function next() {
    if (i + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setGuess(1970);
    setLocked(false);
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="microlabel">final score</p>
        <p className="display tabular text-8xl text-music">{score}</p>
        <p className="mt-2 text-muted">out of {rounds.length * 100}</p>
        <button
          onClick={() => {
            setI(0);
            setGuess(1970);
            setLocked(false);
            setScore(0);
            setDone(false);
          }}
          className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
        >
          rewind the clock
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Clock</h1>
        <div className="text-right">
          <div className="microlabel">round {i + 1}/{rounds.length} · score</div>
          <div className="tabular text-3xl font-black text-music">{score}</div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <span className="microlabel" style={{ color: CATEGORY_HEX[q.category] }}>
          {CATEGORY_LABEL[q.category]}
        </span>
        <p className="display mt-3 text-2xl leading-tight sm:text-3xl">{q.prompt}</p>
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
            <button
              onClick={lock}
              className="microlabel mt-8 rounded-full border border-music px-8 py-3 text-music transition hover:bg-music hover:text-bg"
            >
              lock it in
            </button>
          </>
        ) : (
          <div className="mt-6">
            <p className="text-muted">
              you said <span className="tabular font-black text-ink">{guess}</span> — off by{" "}
              <span className="tabular font-black text-ink">{Math.abs(guess - truth)}</span>{" "}
              {Math.abs(guess - truth) === 1 ? "year" : "years"}
            </p>
            <p className="mt-2 text-2xl font-black text-music">+{pts} pts</p>
            {q.source_url && (
              <a href={q.source_url} target="_blank" rel="noreferrer" className="microlabel underline">
                source
              </a>
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
    </div>
  );
}
