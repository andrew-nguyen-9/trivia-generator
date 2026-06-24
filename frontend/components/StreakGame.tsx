"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CATEGORY_HEX, type Question } from "@/lib/types";
import {
  answerSeconds,
  flameBrightness,
  buildStreakDeck,
} from "@/lib/streak";
import { usePractice } from "@/lib/usePractice";
import PracticeBar from "@/components/PracticeBar";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";

const BEST_KEY = "parlor:streak:best";

const fmt = (n: number) =>
  n >= 10000 ? n.toLocaleString() : Number.isInteger(n) ? String(n) : n.toFixed(1);

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

/** The Witch's candle. Bloom + flame scale with --flame; it lives BEHIND the
 *  Q&A (own stacking context, low z) so it can never wash out the text. */
function Candle({ brightness }: { brightness: number }) {
  return (
    <div
      className="pointer-events-none relative h-24 w-16"
      style={{ ["--flame" as string]: brightness }}
      aria-hidden
    >
      <div className="streak-bloom absolute inset-x-[-60%] inset-y-[-90%]" />
      {/* flame */}
      <div
        className="streak-flame absolute left-1/2 top-1 h-8 w-4 -translate-x-1/2 rounded-[50%_50%_50%_50%/60%_60%_40%_40%]"
        style={{
          background:
            "radial-gradient(circle at 50% 70%, #fff6d2 0%, #f5c542 35%, #e0871f 75%, #b8392b 100%)",
        }}
      />
      {/* wick + candle body */}
      <div className="absolute left-1/2 top-9 h-2 w-px -translate-x-1/2 bg-ink/60" />
      <div className="absolute left-1/2 top-10 h-12 w-6 -translate-x-1/2 rounded-t-sm bg-gradient-to-b from-[#efe3c0] to-[#c9a24a]" />
    </div>
  );
}

export default function StreakGame({ pool }: { pool: Question[] }) {
  const { practiceMode, togglePractice, saved, saveQ, removeQ, isSaved } = usePractice();
  const { record } = useProfile();
  const reduced = Boolean(useReducedMotion());

  const [deck, setDeck] = useState<Question[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"idle" | "guessing" | "reveal-win" | "reveal-loss">(
    "idle",
  );
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const recorded = useRef(false);

  useEffect(() => {
    setBest(Number(localStorage.getItem(BEST_KEY) ?? 0));
  }, []);

  const q = deck[0];
  const brightness = reduced ? 0.7 : flameBrightness(streak);

  // end the run (wrong call OR timeout)
  const lose = useCallback(() => {
    sfx.wrong();
    haptic.wrong();
    setPhase("reveal-loss");
  }, []);

  // record the run when it ends
  useEffect(() => {
    if (phase !== "reveal-loss" || recorded.current) return;
    recorded.current = true;
    const unlocked = record({ room: "streak", score: streak, xp: streak * 50 });
    if (unlocked.length) setToasts(unlocked);
  }, [phase, streak, record]);

  // accelerating countdown — only while actively guessing
  useEffect(() => {
    if (phase !== "guessing" || !q) return;
    const total = answerSeconds(streak);
    setTimeLeft(total);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const remaining = total - (t - start) / 1000;
      if (remaining <= 0) {
        setTimeLeft(0);
        lose();
        return;
      }
      setTimeLeft(remaining);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, streak, q, lose]);

  // cursor-following glow on the darkness finish
  function onPointerMove(e: React.PointerEvent) {
    if (phase !== "reveal-loss" || reduced) return;
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    document.documentElement.style.setProperty("--gx", `${x}%`);
    document.documentElement.style.setProperty("--gy", `${y}%`);
  }

  function start() {
    setDeck(buildStreakDeck(pool));
    setStreak(0);
    setPhase("guessing");
    recorded.current = false;
    setCopied(false);
  }

  function guess(dir: "higher" | "lower") {
    if (!q) return;
    const win = dir === q.correct;
    if (win) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) {
        setBest(s);
        localStorage.setItem(BEST_KEY, String(s));
      }
      sfx.combo(Math.min(s, 8));
      haptic.correct();
      setPhase("reveal-win");
    } else {
      lose();
    }
  }

  function next() {
    setDeck((d) => d.slice(1));
    setPhase("guessing");
  }

  async function share() {
    const flames = "🔥".repeat(Math.min(streak, 10)) || "🕯️";
    const line = `THE STREAK — the Witch's candle\nstreak ${streak} ${flames}\nbest ${best}\nparlor`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the line is on screen anyway */
    }
  }

  if (phase === "idle" || pool.length === 0) {
    return (
      <>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <Candle brightness={0.5} />
          <h1 className="display mt-4 text-5xl sm:text-6xl">Ignite</h1>
          <p className="microlabel mt-2 text-history">The Witch of the Order</p>
          <p className="mt-3 max-w-md text-muted">
            Feed her flame. Higher or lower? Each correct call burns brighter — but
            the candle gutters faster as you climb. One wrong call or a guttered
            flame ends the run. Best so far:{" "}
            <span className="font-black text-ink">{best}</span>
          </p>
          {pool.length === 0 ? (
            <p className="mt-6 text-muted">The bank is still warming up.</p>
          ) : (
            <button
              onClick={start}
              className="microlabel mt-8 rounded-full border border-screen px-8 py-3 text-screen transition hover:bg-screen hover:text-bg"
            >
              light the candle
            </button>
          )}
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

  if (!q) {
    return (
      <>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="display text-4xl text-screen">
            Bank exhausted — streak {streak}!
          </p>
          <button
            onClick={start}
            className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
          >
            relight
          </button>
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

  const revealing = phase !== "guessing";
  const lost = phase === "reveal-loss";
  const hex = CATEGORY_HEX[q.category];
  const total = answerSeconds(streak);
  const timerPct = Math.max(0, Math.min(1, timeLeft / total));

  return (
    <div className="relative" onPointerMove={onPointerMove}>
      {/* darkness finish — fixed, BEHIND the content (z-0); content sits at z-10 */}
      {lost && <div className="streak-dark" aria-hidden />}

      <AchievementToast queue={toasts} />

      <div className="relative z-10">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="display text-4xl sm:text-5xl">Ignite</h1>
            <p className="microlabel mt-1 text-history">The Witch of the Order</p>
          </div>
          <div className="flex items-center gap-4">
            {!lost && <Candle brightness={brightness} />}
            <div className="text-right">
              <div className="microlabel">streak · best {best}</div>
              <div className="tabular text-3xl font-black text-screen">{streak}</div>
            </div>
          </div>
        </div>

        {/* accelerating ring/bar timer — only while guessing */}
        {!revealing && (
          <div className="mt-4">
            <div className="microlabel flex justify-between">
              <span>candle burning</span>
              <span className="tabular">{timeLeft.toFixed(1)}s</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${timerPct * 100}%`,
                  background: timerPct < 0.3 ? "#b83468" : "#f5c542",
                }}
              />
            </div>
          </div>
        )}

        <p className="microlabel mt-6">{q.prompt}</p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <p className="microlabel">{q.unit}</p>
            <p className="display mt-2 text-3xl">{q.subject_a}</p>
            <p className="tabular mt-4 text-4xl font-black" style={{ color: hex }}>
              {fmt(q.value_a!)}
            </p>
          </div>

          <div
            className="rounded-2xl border p-6"
            style={{ borderColor: hex, background: `${hex}10` }}
          >
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
              <div className="mx-auto max-w-md rounded-2xl border border-screen/40 bg-bg/90 p-6 backdrop-blur">
                <p className="display text-3xl text-music">
                  The candle gutters — streak {streak}
                </p>
                <p className="mt-2 text-muted">
                  {timeLeft <= 0 ? "Time ran out." : "Wrong call."} The Witch waits.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={share}
                    className="microlabel rounded-full border border-history px-6 py-3 text-history transition hover:bg-history hover:text-bg"
                  >
                    {copied ? "copied ✓" : "share result"}
                  </button>
                  <button
                    onClick={start}
                    className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
                  >
                    relight
                  </button>
                </div>
                <div className="mt-4 flex justify-center">
                  <LeaderboardPanel room="streak" score={streak} accent="screen" />
                </div>
              </div>
            ) : (
              <>
                <p className="display text-3xl text-sports">Brighter ✓</p>
                <button
                  onClick={next}
                  className="microlabel mt-5 rounded-full border border-ink px-8 py-3 transition hover:bg-ink hover:text-bg"
                >
                  next pair →
                </button>
              </>
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
            {q.source_url && (
              <div className="mt-3">
                <a
                  href={q.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="microlabel underline"
                >
                  source
                </a>
              </div>
            )}
          </motion.div>
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
