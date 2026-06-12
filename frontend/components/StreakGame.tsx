"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CATEGORY_HEX, type Question } from "@/lib/types";

const BEST_KEY = "parlor:streak:best";

const fmt = (n: number) =>
  n >= 10000 ? n.toLocaleString() : Number.isInteger(n) ? String(n) : n.toFixed(1);

/** Count-up reveal for the hidden value (UI_SPEC: number reveals). */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 600);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span className="tabular">{fmt(Math.round(v * 10) / 10)}</span>;
}

export default function StreakGame({ pool }: { pool: Question[] }) {
  const [deck, setDeck] = useState<Question[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"idle" | "guessing" | "reveal-win" | "reveal-loss">("idle");

  useEffect(() => {
    setBest(Number(localStorage.getItem(BEST_KEY) ?? 0));
  }, []);

  function start() {
    setDeck([...pool].sort(() => Math.random() - 0.5));
    setStreak(0);
    setPhase("guessing");
  }

  const q = deck[0];

  function guess(dir: "higher" | "lower") {
    const win = dir === q.correct;
    if (win) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) {
        setBest(s);
        localStorage.setItem(BEST_KEY, String(s));
      }
    }
    setPhase(win ? "reveal-win" : "reveal-loss");
  }

  function next() {
    setDeck((d) => d.slice(1));
    setPhase("guessing");
  }

  if (phase === "idle" || pool.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="display text-5xl sm:text-6xl">The Streak</h1>
        <p className="mt-3 max-w-md text-muted">
          Higher or lower? One wrong call ends the run. Best so far:{" "}
          <span className="font-black text-ink">{best}</span>
        </p>
        {pool.length === 0 ? (
          <p className="mt-6 text-muted">The bank is still warming up.</p>
        ) : (
          <button
            onClick={start}
            className="microlabel mt-8 rounded-full border border-screen px-8 py-3 text-screen transition hover:bg-screen hover:text-bg"
          >
            start the run
          </button>
        )}
      </div>
    );
  }

  if (!q) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="display text-4xl text-screen">Deck exhausted — streak {streak}!</p>
        <button onClick={start} className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg">
          reshuffle
        </button>
      </div>
    );
  }

  const revealing = phase !== "guessing";
  const lost = phase === "reveal-loss";
  const hex = CATEGORY_HEX[q.category];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Streak</h1>
        <div className="text-right">
          <div className="microlabel">streak · best {best}</div>
          <div className="tabular text-3xl font-black text-screen">{streak}</div>
        </div>
      </div>

      <p className="microlabel mt-6">{q.prompt}</p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <p className="microlabel">{q.unit}</p>
          <p className="display mt-2 text-3xl">{q.subject_a}</p>
          <p className="tabular mt-4 text-4xl font-black" style={{ color: hex }}>
            {fmt(q.value_a!)}
          </p>
        </div>

        <div className="rounded-2xl border p-6" style={{ borderColor: hex, background: `${hex}10` }}>
          <p className="microlabel">{q.unit}</p>
          <p className="display mt-2 text-3xl">{q.subject_b}</p>
          <p className="mt-4 text-4xl font-black" style={{ color: hex }}>
            {revealing ? <CountUp to={q.value_b!} /> : "???"}
          </p>
        </div>
      </div>

      {!revealing ? (
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => guess("higher")}
            className="microlabel rounded-full border border-sports px-8 py-4 text-sports transition hover:bg-sports hover:text-bg"
          >
            ▲ higher
          </button>
          <button
            onClick={() => guess("lower")}
            className="microlabel rounded-full border border-music px-8 py-4 text-music transition hover:bg-music hover:text-bg"
          >
            ▼ lower
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 text-center"
        >
          {lost ? (
            <>
              <p className="display text-3xl text-music">Run over — streak {streak}</p>
              <button
                onClick={start}
                className="microlabel mt-5 rounded-full border border-ink px-8 py-3 transition hover:bg-ink hover:text-bg"
              >
                run it back
              </button>
            </>
          ) : (
            <>
              <p className="display text-3xl text-sports">Called it ✓</p>
              <button
                onClick={next}
                className="microlabel mt-5 rounded-full border border-ink px-8 py-3 transition hover:bg-ink hover:text-bg"
              >
                next pair →
              </button>
            </>
          )}
          {q.source_url && (
            <div className="mt-3">
              <a href={q.source_url} target="_blank" rel="noreferrer" className="microlabel underline">
                source
              </a>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
