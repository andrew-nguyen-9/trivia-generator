"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { CATEGORY_HEX, CATEGORY_LABEL, type Question } from "@/lib/types";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { shuffled } from "@/lib/rng";
import { filterByDeck, filterByDifficulty } from "@/lib/decks";
import dynamic from "next/dynamic";
// code-split: the win-only canvas confetti is fetched on demand, not in
// the room's initial bundle (perf 2.16).
const Confetti = dynamic(() => import("@/components/Confetti"), { ssr: false });
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import RoomFilters from "@/components/RoomFilters";

const START_TIME = 60; // seconds
const COMBO_BONUS = 5; // every N-in-a-row grants bonus time
const BONUS_SECONDS = 3;
const PENALTY = 2;

type Phase = "idle" | "playing" | "over";

export default function BlitzGame({ pool }: { pool: Question[] }) {
  const { record } = useProfile();
  const shake = useAnimationControls();

  const [phase, setPhase] = useState<Phase>("idle");
  const [deck, setDeck] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const [time, setTime] = useState(START_TIME);
  const [correct, setCorrect] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const [burst, setBurst] = useState(0);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [deckId, setDeckId] = useState("all");
  const [diff, setDiff] = useState<"any" | "easy" | "medium" | "hard">("any");
  const locked = useRef(false);

  const activePool = useMemo(
    () => filterByDifficulty(filterByDeck(pool, deckId), diff),
    [pool, deckId, diff],
  );

  const reshuffle = useCallback(
    (n: number) => shuffled(activePool, () => Math.random()).slice(0, Math.max(n, 1)),
    [activePool],
  );

  const q = deck[idx];

  const advance = useCallback(
    (d: Question[], n: number) => {
      let next = n + 1;
      let dk = d;
      if (next >= d.length) {
        dk = reshuffle(d.length);
        next = 0;
        setDeck(dk);
      }
      setIdx(next);
      setOrder(shuffled(dk[next].choices ?? [], () => Math.random()));
      locked.current = false;
    },
    [reshuffle],
  );

  function start() {
    const dk = reshuffle(40);
    setDeck(dk);
    setIdx(0);
    setOrder(shuffled(dk[0].choices ?? [], () => Math.random()));
    setTime(START_TIME);
    setCorrect(0);
    setCombo(0);
    setBestCombo(0);
    setPhase("playing");
    locked.current = false;
  }

  // Countdown
  useEffect(() => {
    if (phase !== "playing") return;
    if (time <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setTime((s) => Math.max(0, s - 1)), 1000);
    if (time <= 5) sfx.countdown();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, phase]);

  // keyboard-first: number keys 1–4 pick an answer
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= order.length) answer(order[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, order]);

  function answer(choice: string) {
    if (locked.current || !q || phase !== "playing") return;
    locked.current = true;
    if (choice === q.correct) {
      const c = combo + 1;
      setCombo(c);
      setBestCombo((b) => Math.max(b, c));
      setCorrect((n) => n + 1);
      setFlash("right");
      sfx.combo(Math.min(c, 8));
      haptic.tap();
      if (c % COMBO_BONUS === 0) {
        setTime((s) => s + BONUS_SECONDS);
        sfx.correct();
      }
    } else {
      setCombo(0);
      setFlash("wrong");
      setTime((s) => Math.max(0, s - PENALTY));
      sfx.wrong();
      haptic.wrong();
      shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.35 } });
    }
    setTimeout(() => setFlash(null), 180);
    setTimeout(() => advance(deck, idx), 130);
  }

  function finish() {
    setPhase("over");
    if (correct >= 15) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({
      room: "blitz",
      score: correct,
      xp: correct * 60,
      correct,
      total: correct,
    });
    if (unlocked.length) setToasts(unlocked);
  }

  if (pool.length === 0) {
    return <p className="text-muted">The bank is still warming up — no questions yet.</p>;
  }

  if (phase === "idle") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="display text-5xl sm:text-6xl">The Blitz</h1>
        <p className="mt-3 max-w-md text-muted">
          Sixty seconds. As many as you can. A wrong answer costs {PENALTY}s and breaks
          your combo — every {COMBO_BONUS} in a row buys you {BONUS_SECONDS}s back.
          Use keys 1–4 to answer.
        </p>
        <div className="mt-8">
          <RoomFilters
            deck={deckId}
            setDeck={setDeckId}
            diff={diff}
            setDiff={setDiff}
            accent="history"
          />
        </div>
        <button
          onClick={start}
          className="microlabel mt-8 rounded-full border border-history px-8 py-3 text-history transition hover:bg-history hover:text-bg"
        >
          start the clock ({activePool.length} in deck)
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="microlabel">answered correctly</p>
          <p className="display tabular text-8xl text-history">{correct}</p>
          <p className="mt-2 text-muted">best combo ×{bestCombo}</p>
          <LeaderboardPanel room="blitz" score={correct} accent="history" />
          <button
            onClick={start}
            className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
          >
            run it back
          </button>
        </div>
      </>
    );
  }

  const hex = CATEGORY_HEX[q?.category ?? "history"];
  const low = time <= 10;

  return (
    <>
      <AchievementToast queue={toasts} />
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="display text-4xl sm:text-5xl">The Blitz</h1>
          <p className="microlabel mt-1">
            {correct} correct{combo >= 2 ? ` · combo ×${combo}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="microlabel">time</div>
          <motion.div
            key={low ? "low" : "ok"}
            animate={low ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.5, repeat: low ? Infinity : 0 }}
            className={`tabular text-5xl font-black ${low ? "text-music" : "text-history"}`}
          >
            {time}
          </motion.div>
        </div>
      </div>

      {/* combo meter */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full"
          style={{ background: hex }}
          animate={{ width: `${((combo % COMBO_BONUS) / COMBO_BONUS) * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <motion.div
        animate={shake}
        className={`mt-5 rounded-2xl border bg-surface p-6 transition-colors sm:p-8 ${
          flash === "right"
            ? "border-sports"
            : flash === "wrong"
              ? "border-music"
              : "border-line"
        }`}
      >
        <span className="microlabel" style={{ color: hex }}>
          {CATEGORY_LABEL[q?.category ?? "history"]}
        </span>
        <p className="display mt-3 text-2xl leading-tight sm:text-3xl">{q?.prompt}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {order.map((choice, k) => (
            <button
              key={choice}
              onClick={() => answer(choice)}
              className="flex items-center gap-3 rounded-xl border border-line p-4 text-left font-bold transition hover:border-ink active:scale-[0.98]"
            >
              <span className="microlabel rounded border border-line px-2 py-0.5 text-muted">
                {k + 1}
              </span>
              {choice}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}
