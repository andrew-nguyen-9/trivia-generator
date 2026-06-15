"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CATEGORIES,
  CATEGORY_HEX,
  CATEGORY_LABEL,
  type Category,
  type Question,
} from "@/lib/types";
import { usePractice } from "@/lib/usePractice";
import PracticeBar from "@/components/PracticeBar";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import Confetti from "@/components/Confetti";
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";

const MAX_QUESTIONS = 20;

function WedgeRing({ earned }: { earned: Set<Category> }) {
  const R = 54;
  const C = 60;
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36">
      {CATEGORIES.map((cat, i) => {
        const a0 = (i / 6) * 2 * Math.PI - Math.PI / 2 + 0.04;
        const a1 = ((i + 1) / 6) * 2 * Math.PI - Math.PI / 2 - 0.04;
        const x0 = C + R * Math.cos(a0);
        const y0 = C + R * Math.sin(a0);
        const x1 = C + R * Math.cos(a1);
        const y1 = C + R * Math.sin(a1);
        const has = earned.has(cat);
        return (
          <motion.path
            key={cat}
            d={`M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`}
            fill={has ? CATEGORY_HEX[cat] : "#0d0d18"}
            stroke="#1a1a2e"
            strokeWidth="1.5"
            animate={has ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: 0.4 }}
            style={{ transformOrigin: "60px 60px" }}
          />
        );
      })}
      <circle cx={C} cy={C} r={20} fill="#06060a" stroke="#1a1a2e" />
      <text
        x={C}
        y={C + 4}
        textAnchor="middle"
        fill="#f0ede6"
        fontSize="11"
        fontWeight="900"
      >
        {earned.size}/6
      </text>
    </svg>
  );
}

export default function WedgesGame({ pool }: { pool: Question[] }) {
  const { practiceMode, togglePractice, saved, saveQ, removeQ, isSaved } = usePractice();

  const byCat = useMemo(() => {
    const m = new Map<Category, Question[]>();
    for (const q of pool) m.set(q.category, [...(m.get(q.category) ?? []), q]);
    return m;
  }, [pool]);

  const { record } = useProfile();
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<Question[]>([]);
  const [asked, setAsked] = useState(0);
  const [earned, setEarned] = useState<Set<Category>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [burst, setBurst] = useState(0);
  const recorded = useRef(false);
  const stats = useRef<Partial<Record<Category, { correct: number; total: number }>>>({});

  function start() {
    const qs = [...pool].sort(() => Math.random() - 0.5);
    setQueue(qs);
    setEarned(new Set());
    setAsked(0);
    setPicked(null);
    setStarted(true);
    setOrder(qs.length ? [...(qs[0].choices ?? [])].sort(() => Math.random() - 0.5) : []);
    recorded.current = false;
    stats.current = {};
  }

  function answer(choice: string) {
    if (picked) return;
    setPicked(choice);
    const q = queue[0];
    const right = choice === q.correct;
    const s = stats.current[q.category] ?? { correct: 0, total: 0 };
    stats.current[q.category] = { correct: s.correct + (right ? 1 : 0), total: s.total + 1 };
    if (right) {
      setEarned((set) => new Set(set).add(q.category));
      sfx.correct();
      haptic.correct();
    } else {
      sfx.wrong();
      haptic.wrong();
    }
  }

  function next() {
    const rest = queue.slice(1);
    setQueue(rest);
    setAsked((n) => n + 1);
    setPicked(null);
    setOrder(
      rest.length ? [...(rest[0].choices ?? [])].sort(() => Math.random() - 0.5) : [],
    );
  }

  const q = queue[0];
  const won = earned.size === 6;
  const over = won || asked >= MAX_QUESTIONS || !q;

  useEffect(() => {
    if (!started || !over || recorded.current) return;
    recorded.current = true;
    if (won) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({
      room: "wedges",
      score: earned.size,
      xp: earned.size * 150 + (won ? 300 : 0),
      perCategory: stats.current,
    });
    if (unlocked.length) setToasts(unlocked);
  }, [started, over, won, earned.size, record]);

  if (!started || pool.length === 0) {
    return (
      <>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="display text-5xl sm:text-6xl">The Wedges</h1>
          <p className="mt-3 max-w-md text-muted">
            Fill all six wedges in {MAX_QUESTIONS} questions or fewer. A correct
            answer earns its category&apos;s wedge.
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

  if (over) {
    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <WedgeRing earned={earned} />
          <p className="display mt-6 text-4xl">
            {won ? "Ring complete!" : `${earned.size} of 6 wedges`}
          </p>
          <p className="mt-2 text-muted">{asked} questions played</p>
          <LeaderboardPanel room="wedges" score={earned.size} accent="sports" />
          <button
            onClick={start}
            className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
          >
            play again
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

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full items-start justify-between">
        <div>
          <h1 className="display text-4xl sm:text-5xl">The Wedges</h1>
          <p className="microlabel mt-1">question {asked + 1}/{MAX_QUESTIONS}</p>
        </div>
        <WedgeRing earned={earned} />
      </div>

      <div className="mt-4 w-full rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <span className="microlabel" style={{ color: CATEGORY_HEX[q.category] }}>
          {CATEGORY_LABEL[q.category]} wedge
          {earned.has(q.category) ? " · already earned" : ""}
        </span>
        <p className="display mt-3 text-2xl leading-tight sm:text-3xl">{q.prompt}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
                onClick={() => answer(choice)}
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

      <div className="w-full">
        <PracticeBar
          practiceMode={practiceMode}
          onToggle={togglePractice}
          saved={saved}
          onRemove={removeQ}
        />
      </div>
    </div>
  );
}
