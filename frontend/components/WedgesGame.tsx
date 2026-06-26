"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CATEGORIES,
  CATEGORY_HEX,
  CATEGORY_LABEL,
  type Category,
  type Question,
} from "@/lib/types";
import { mulberry32, hashKey, shuffled } from "@/lib/rng";
import {
  buildDailyWedges,
  shatterMirror,
  ghostQuip,
  GHOST_NAME,
  type MirrorShard,
} from "@/lib/wedges";
import { buildShare, type GameResult } from "@/lib/share";
import styles from "./WedgesGame.module.css";
import { usePractice } from "@/lib/usePractice";
import PracticeBar from "@/components/PracticeBar";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import dynamic from "next/dynamic";
// code-split: the win-only canvas confetti is fetched on demand, not in
// the room's initial bundle (perf 2.16).
const Confetti = dynamic(() => import("@/components/Confetti"), { ssr: false });
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";

const QUESTION_SECONDS = 15;
// Speed bonus: a correct wedge is worth a flat base plus the seconds left on the
// clock — answer fast, score more. Timeouts and misses earn nothing.
const WEDGE_BASE = 100;
const SPEED_PER_SECOND = 20;

/** Deterministic choice order keyed by the prompt (SSR/client agree, comparable). */
function dailyChoices(q: Question): string[] {
  const choices = q.choices ?? [q.correct];
  return shuffled(choices, mulberry32(hashKey(q.prompt)));
}

/** The shattered mirror — six wedges that crack along daily-shifting fault lines. */
function ShatteredMirror({
  shards,
  earned,
  reduced,
}: {
  shards: MirrorShard[];
  earned: Set<Category>;
  reduced: boolean;
}) {
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36 drop-shadow-[0_0_12px_rgba(0,0,0,0.6)]">
      <circle cx={60} cy={60} r={56} fill="#06060a" stroke="#1a1a2e" />
      {shards.map((shard) => {
        const has = earned.has(shard.category);
        return (
          <motion.path
            key={shard.category}
            d={shard.path}
            fill={has ? shard.fill : "#0d0d18"}
            stroke="#1a1a2e"
            strokeWidth="0.8"
            animate={has && !reduced ? { opacity: [0.4, 1], scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.4 }}
            style={{ transformOrigin: "60px 60px" }}
          />
        );
      })}
      <circle cx={60} cy={60} r={18} fill="#06060a" stroke="#1a1a2e" />
      <text x={60} y={64} textAnchor="middle" fill="#f0ede6" fontSize="11" fontWeight="900">
        {earned.size}/6
      </text>
    </svg>
  );
}

/** The resident ghost — drifts in with a quip on a miss/timeout. */
function Ghost({ quip, reduced }: { quip: string | null; reduced: boolean }) {
  if (!quip) return null;
  return (
    <motion.div
      className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-surface/70 p-4"
      initial={reduced ? { opacity: 1 } : { opacity: 0, x: -12 }}
      animate={
        reduced
          ? { opacity: 1 }
          : { opacity: 1, x: 0, y: [0, -3, 0] }
      }
      transition={reduced ? {} : { y: { duration: 3, repeat: Infinity }, opacity: { duration: 0.5 } }}
    >
      <span className="text-2xl" aria-hidden>
        👻
      </span>
      <div>
        <p className="microlabel text-history">{GHOST_NAME}</p>
        <p className="mt-1 italic text-muted">&ldquo;{quip}&rdquo;</p>
      </div>
    </motion.div>
  );
}

/** The six-wedge lockout legend. Each chip shows its wedge's state: earned and
 *  locked (✓, filled), the active wedge (•), or still-pending (dim) — so the
 *  per-category lockout is legible at a glance, not just implied by the ring. */
function WedgeLegend({ earned, active }: { earned: Set<Category>; active: Category | null }) {
  return (
    <div className={styles.legend}>
      {CATEGORIES.map((cat) => {
        const has = earned.has(cat);
        const isActive = !has && cat === active;
        const hex = CATEGORY_HEX[cat];
        return (
          <div
            key={cat}
            className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition"
            style={{
              borderColor: has || isActive ? hex : undefined,
              background: has ? `${hex}1f` : undefined,
              color: has || isActive ? hex : undefined,
              opacity: has || isActive ? 1 : 0.45,
            }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hex }} />
            <span className="truncate">{CATEGORY_LABEL[cat]}</span>
            <span className="ml-auto" aria-hidden>
              {has ? "✓" : isActive ? "•" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function WedgesGame({ pool, day }: { pool: Question[]; day: number }) {
  const { practiceMode, togglePractice, saved, saveQ, removeQ, isSaved } = usePractice();
  const { record } = useProfile();
  const reduced = Boolean(useReducedMotion());

  // The shared daily partition: per-category order, the served slice, the bonus
  // remainder. Identical for every player on `day` (SSR-deterministic).
  const daily = useMemo(() => buildDailyWedges(pool, day), [pool, day]);
  const shards = useMemo(() => shatterMirror(day), [day]);

  // Main-round queue: the served slices, interleaved round-robin across categories
  // so wedges fill evenly. Deterministic from the daily partition.
  const mainQueue = useMemo<Question[]>(() => {
    const out: Question[] = [];
    for (let i = 0; ; i++) {
      let added = false;
      for (const cat of CATEGORIES) {
        const q = daily.served[cat][i];
        if (q) {
          out.push(q);
          added = true;
        }
      }
      if (!added) break;
    }
    return out;
  }, [daily]);

  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<"main" | "bonus">("main");
  const [idx, setIdx] = useState(0);
  const [earned, setEarned] = useState<Set<Category>>(new Set());
  const [locked, setLocked] = useState<Set<Category>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const [quip, setQuip] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [points, setPoints] = useState(0);
  const [flash, setFlash] = useState<number | null>(null); // last speed-bonus "+N"
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [burst, setBurst] = useState(0);
  const recorded = useRef(false);
  const stats = useRef<Partial<Record<Category, { correct: number; total: number }>>>({});

  const queue = phase === "main" ? mainQueue : daily.bonus;

  // Advance past any locked-out categories (their wedge is complete).
  const visibleIdx = useMemo(() => {
    let i = idx;
    while (i < queue.length && locked.has(queue[i].category)) i++;
    return i;
  }, [idx, queue, locked]);

  const q = queue[visibleIdx];
  const order = useMemo(() => (q ? dailyChoices(q) : []), [q]);
  const wonRing = earned.size === 6;
  const mainDone = phase === "main" && (wonRing || visibleIdx >= queue.length);
  const over = phase === "bonus" && visibleIdx >= queue.length;

  function start() {
    setStarted(true);
    setPhase("main");
    setIdx(0);
    setEarned(new Set());
    setLocked(new Set());
    setPicked(null);
    setQuip(null);
    setSecondsLeft(QUESTION_SECONDS);
    setPoints(0);
    setFlash(null);
    setCopied(false);
    recorded.current = false;
    stats.current = {};
  }

  function resolve(choice: string | null) {
    if (picked || !q) return;
    setPicked(choice ?? "⏱");
    const right = choice === q.correct;
    const s = stats.current[q.category] ?? { correct: 0, total: 0 };
    stats.current[q.category] = {
      correct: s.correct + (right ? 1 : 0),
      total: s.total + 1,
    };
    if (right) {
      setEarned((set) => {
        const next = new Set(set).add(q.category);
        return next;
      });
      // Lockout: once a category is earned, it serves no more questions.
      setLocked((set) => new Set(set).add(q.category));
      // Speed bonus: base + whatever seconds remain when answered.
      const bonus = WEDGE_BASE + secondsLeft * SPEED_PER_SECOND;
      setPoints((p) => p + bonus);
      setFlash(bonus);
      sfx.correct();
      haptic.correct();
      setQuip(null);
    } else {
      sfx.wrong();
      haptic.wrong();
      // The ghost jabs — deterministic per (question, miss kind).
      setQuip(ghostQuip(`${q.prompt}|${choice ?? "timeout"}`));
    }
  }

  function next() {
    setPicked(null);
    setQuip(null);
    setFlash(null);
    setSecondsLeft(QUESTION_SECONDS);
    setIdx(visibleIdx + 1);
  }

  function toBonus() {
    setPhase("bonus");
    setIdx(0);
    setPicked(null);
    setQuip(null);
    setSecondsLeft(QUESTION_SECONDS);
  }

  // Per-question countdown. On timeout, auto-resolve as a miss.
  useEffect(() => {
    if (!started || picked || !q || over || mainDone) return;
    if (secondsLeft <= 0) {
      resolve(null);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [started, picked, q, over, mainDone, secondsLeft]);

  // Record result once when the run is fully over.
  useEffect(() => {
    if (!started || !over || recorded.current) return;
    recorded.current = true;
    if (wonRing) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({
      room: "wedges",
      score: earned.size,
      xp: earned.size * 150 + (wonRing ? 300 : 0) + points,
      perCategory: stats.current,
    });
    if (unlocked.length) setToasts(unlocked);
  }, [started, over, wonRing, earned.size, points, record]);

  if (!started || pool.length === 0) {
    return (
      <>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="display text-5xl sm:text-6xl">Fractures</h1>
          <p className="mt-3 max-w-md text-muted">
            Shatter the mirror — earn all six wedges. Today&apos;s questions are
            the same for every player; beat the clock before the ghost speaks.
          </p>
          {pool.length === 0 ? (
            <p className="mt-6 text-muted">The bank is still warming up.</p>
          ) : (
            <button
              onClick={start}
              className="microlabel mt-8 rounded-full border border-sports px-8 py-3 text-sports transition hover:bg-sports hover:text-bg"
            >
              deal me in
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

  // Interlude between the six wedges and the optional bonus round.
  if (mainDone) {
    return (
      <>
        <Confetti trigger={wonRing ? 1 : 0} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <ShatteredMirror shards={shards} earned={earned} reduced={reduced} />
          <p className="display mt-6 text-4xl">
            {wonRing ? "Mirror shattered!" : `${earned.size} of 6 wedges`}
          </p>
          <p className="mt-2 text-muted">
            {daily.bonus.length > 0
              ? "The bonus round holds the questions you never saw today."
              : "No questions left unseen — you faced them all."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {daily.bonus.length > 0 && (
              <button
                onClick={toBonus}
                className="microlabel rounded-full border border-history px-6 py-3 text-history transition hover:bg-history hover:text-bg"
              >
                bonus round →
              </button>
            )}
            <button
              onClick={() => {
                setPhase("bonus");
                setIdx(daily.bonus.length); // skip straight to the end screen
              }}
              className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
            >
              finish
            </button>
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

  if (over || !q) {
    // The filled-ring run → six tiers (one per wedge, earned = 🟩) + OG card,
    // all via the §3.0 share seam. `date` is a cosmetic label; the daily board
    // is day-seeded upstream, so a client Date() on this click is hydration-safe.
    // ponytail: client Date() here — page.tsx isn't ours to edit.
    const result: GameResult = {
      room: "/wedges",
      date: new Date().toISOString().slice(0, 10),
      tiers: CATEGORIES.map((c) => (earned.has(c) ? "hit" : "miss")),
      score: earned.size,
      maxScore: 6,
      columns: 3,
    };
    const card = buildShare(result);
    const shareResult = () => {
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          void navigator.share({ text: card.text, url: card.url }).catch(() => {});
        } else {
          void navigator.clipboard?.writeText(card.text);
        }
      } catch {
        /* clipboard/share unavailable — silently no-op */
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <ShatteredMirror shards={shards} earned={earned} reduced={reduced} />
          <p className="display mt-6 text-4xl">
            {wonRing ? "Mirror shattered!" : `${earned.size} of 6 wedges`}
          </p>
          <p className="mt-2 text-muted">
            <span className="tabular-nums font-black text-sports">{points}</span> points
          </p>

          {/* The filled-ring emoji — the §3.3 social artifact. */}
          <p className="microlabel mt-6 text-muted">your ring</p>
          <div className={`mt-1 ${styles.ringShare}`} aria-label="filled wedge ring">
            {card.grid}
          </div>

          <LeaderboardPanel room="wedges" score={earned.size} accent="sports" />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={shareResult}
              className="microlabel rounded-full border border-sports px-6 py-3 text-sports transition hover:bg-sports hover:text-bg"
            >
              {copied ? "copied ✓" : "share ring"}
            </button>
            <button
              onClick={start}
              className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
            >
              play again
            </button>
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

  const timeRatio = secondsLeft / QUESTION_SECONDS;
  const lowTime = timeRatio < 0.34;

  return (
    <div>
      <div className={styles.play}>
        {/* Ring column — leads on mobile, swaps to the right on desktop so the
            ring + score + legend sit beside the question within one screen. */}
        <aside className={styles.aside}>
          <div className="text-center">
            <h1 className="display text-3xl sm:text-4xl">Fractures</h1>
            <p className="microlabel mt-1">
              {phase === "bonus" ? "bonus round" : "the six wedges"}
            </p>
          </div>
          <div className="relative">
            <ShatteredMirror shards={shards} earned={earned} reduced={reduced} />
            {flash != null && (
              <motion.span
                key={points}
                className="absolute -right-1 top-1 text-lg font-black text-sports"
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 0 }}
                animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: -20 }}
                transition={{ duration: 1.4 }}
                aria-hidden
              >
                +{flash}
              </motion.span>
            )}
          </div>
          <div className="text-center">
            <p className="microlabel text-muted">score</p>
            <p className="display tabular text-4xl text-sports">{points}</p>
          </div>
          <WedgeLegend earned={earned} active={q.category} />
        </aside>

        {/* Question card — the wider main column on desktop. */}
        <div className={`${styles.card} rounded-2xl border border-line bg-surface p-5 sm:p-7`}>
          <div className="flex items-center justify-between">
            <span className="microlabel" style={{ color: CATEGORY_HEX[q.category] }}>
              {CATEGORY_LABEL[q.category]} wedge
            </span>
            {!picked && (
              <span
                className="microlabel tabular-nums"
                style={{ color: lowTime ? CATEGORY_HEX.music : undefined }}
              >
                {secondsLeft}s{lowTime ? "" : " · faster = more"}
              </span>
            )}
          </div>
          {/* Countdown bar */}
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{
                width: picked ? "100%" : `${timeRatio * 100}%`,
                background: CATEGORY_HEX[q.category],
              }}
            />
          </div>

          <p className="display mt-4 text-2xl leading-tight sm:text-3xl">{q.prompt}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {order.map((choice) => {
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
                  onClick={() => resolve(choice)}
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

          <Ghost quip={quip} reduced={reduced} />

          {picked && (
            <div className="mt-5 flex items-center gap-4">
              <button
                onClick={next}
                className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
              >
                next →
              </button>
              {practiceMode && (
                <button
                  onClick={() => (isSaved(q) ? removeQ(q.prompt) : saveQ(q))}
                  className={`microlabel rounded-full border px-4 py-2 transition ${
                    isSaved(q)
                      ? "border-history text-history"
                      : "border-line text-muted hover:border-history hover:text-history"
                  }`}
                >
                  {isSaved(q) ? "★ saved" : "☆ save"}
                </button>
              )}
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
            </div>
          )}
        </div>
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
