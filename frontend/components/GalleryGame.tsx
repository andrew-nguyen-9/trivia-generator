"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CATEGORY_HEX, type Question } from "@/lib/types";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { shuffled } from "@/lib/rng";
import Confetti from "@/components/Confetti";
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";

const ROUNDS = 5;
const MAX_BLUR = 24; // px
const REVEAL_MS = 6000; // time to fully sharpen if you wait

export default function GalleryGame({ pool }: { pool: Question[] }) {
  const reduced = useReducedMotion();
  const { record } = useProfile();
  const [rounds, setRounds] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [blur, setBlur] = useState(MAX_BLUR);
  const [score, setScore] = useState(0);
  const [roundPts, setRoundPts] = useState(0);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const raf = useRef<number>();
  const startedAt = useRef(0);

  const start = useMemo(
    () => () => {
      setRounds(shuffled(pool, () => Math.random()).slice(0, ROUNDS));
      setI(0);
      setPicked(null);
      setScore(0);
      setDone(false);
    },
    [pool],
  );

  useEffect(() => {
    start();
  }, [start]);

  // Sharpen the current image over REVEAL_MS until a guess freezes it.
  useEffect(() => {
    if (done || picked || reduced) {
      if (reduced) setBlur(0);
      return;
    }
    setBlur(MAX_BLUR);
    startedAt.current = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - startedAt.current) / REVEAL_MS);
      setBlur(MAX_BLUR * (1 - p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current ?? 0);
  }, [i, picked, done, reduced]);

  const q = rounds[i];

  function choose(choice: string) {
    if (picked || !q) return;
    cancelAnimationFrame(raf.current ?? 0);
    setPicked(choice);
    if (choice === q.correct) {
      const pts = Math.round(20 + 80 * (blur / MAX_BLUR)); // earlier = sharper bonus
      setRoundPts(pts);
      setScore((s) => s + pts);
      sfx.correct();
      haptic.correct();
    } else {
      setRoundPts(0);
      sfx.wrong();
      haptic.wrong();
    }
  }

  function next() {
    if (i + 1 >= rounds.length) {
      finish();
      return;
    }
    setI(i + 1);
    setPicked(null);
  }

  function finish() {
    setDone(true);
    if (score >= ROUNDS * 50) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({
      room: "gallery",
      score,
      xp: score,
      perCategory: q ? { [q.category]: { correct: 0, total: 0 } } : undefined,
    });
    if (unlocked.length) setToasts(unlocked);
  }

  if (pool.length === 0) {
    return <p className="text-muted">The bank is still warming up — no images yet.</p>;
  }

  if (done) {
    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="microlabel">final score</p>
          <p className="display tabular text-8xl text-screen">{score}</p>
          <p className="mt-2 text-muted">out of {ROUNDS * 100}</p>
          <LeaderboardPanel room="gallery" score={score} accent="screen" />
          <button
            onClick={start}
            className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
          >
            new gallery
          </button>
        </div>
      </>
    );
  }

  const hex = CATEGORY_HEX[q?.category ?? "screen"];

  return (
    <>
      <AchievementToast queue={toasts} />
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Gallery</h1>
        <div className="text-right">
          <div className="microlabel">round {i + 1}/{ROUNDS} · score</div>
          <div className="tabular text-3xl font-black text-screen">{score}</div>
        </div>
      </div>

      <p className="microlabel mt-5">{q?.prompt}</p>

      <div className="mt-3 flex justify-center">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={q?.image_url ?? ""}
            alt="guess the subject"
            className="h-64 w-auto max-w-full object-contain transition-[filter] sm:h-80"
            style={{ filter: `blur(${blur.toFixed(1)}px)` }}
            draggable={false}
          />
          {!picked && (
            <div
              className="pointer-events-none absolute bottom-2 right-3 microlabel"
              style={{ color: hex }}
            >
              sharpening…
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(q?.choices ?? []).map((choice) => {
          const isCorrect = choice === q.correct;
          const isPicked = choice === picked;
          const cls = picked
            ? isCorrect
              ? "border-sports bg-sports/15 text-sports"
              : isPicked
                ? "border-music bg-music/15 text-music"
                : "border-line text-muted"
            : "border-line hover:border-ink";
          return (
            <button
              key={choice}
              onClick={() => choose(choice)}
              disabled={Boolean(picked)}
              className={`rounded-xl border p-4 text-left font-bold transition ${cls}`}
            >
              {choice}
              {picked && isCorrect && " ✓"}
              {picked && isPicked && !isCorrect && " ✗"}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-6 flex items-center gap-4">
          <span className="text-xl font-black" style={{ color: roundPts ? hex : "#8b8b9e" }}>
            {roundPts ? `+${roundPts}` : "missed"}
          </span>
          <button
            onClick={next}
            className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
          >
            {i + 1 >= rounds.length ? "see score" : "next →"}
          </button>
          {q.source_url && (
            <a href={q.source_url} target="_blank" rel="noreferrer" className="microlabel underline">
              source
            </a>
          )}
        </div>
      )}
    </>
  );
}
