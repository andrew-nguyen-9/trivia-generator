"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pickRotating } from "@/lib/rng";
import { CATEGORY_HEX, type Question } from "@/lib/types";
import { sfxCorrect, sfxWrong, sfxPianoChord } from "@/lib/sound";

const CHAIN_LENGTH = 7;

interface ChainNode {
  question: Question;
  state: "pending" | "correct" | "wrong" | "revealed";
}

export default function ThreadGame({ pool }: { pool: Question[] }) {
  const chain = useMemo<ChainNode[]>(() => {
    const picked = pickRotating(pool, CHAIN_LENGTH);
    return picked.map((q) => ({ question: q, state: "pending" }));
  }, [pool]);

  const [nodes, setNodes] = useState<ChainNode[]>(chain);
  const [active, setActive] = useState(0);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [active]);

  if (pool.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">🕯️</p>
        <p className="text-muted">The thread is not yet spun.</p>
        <p className="microlabel">check back once the nightly forge runs</p>
      </div>
    );
  }

  function handleGuess() {
    const node = nodes[active];
    if (!node || node.state !== "pending") return;

    const guess = input.trim().toLowerCase();
    const correct = node.question.correct.toLowerCase();
    const isCorrect =
      guess === correct ||
      correct.includes(guess) ||
      guess.includes(correct.split(" ")[0]);

    const newState: ChainNode["state"] = isCorrect ? "correct" : "wrong";
    const updated = nodes.map((n, i) =>
      i === active ? { ...n, state: newState } : n,
    );

    if (isCorrect) {
      sfxCorrect();
      setScore((s) => s + 1);
    } else {
      sfxWrong();
      updated[active] = { ...updated[active], state: "revealed" };
    }

    setNodes(updated);
    setInput("");

    if (active + 1 >= CHAIN_LENGTH) {
      sfxPianoChord();
      setDone(true);
    } else {
      setActive((a) => a + 1);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center"
      >
        <p className="microlabel tracking-widest text-brass">thread complete</p>
        <p className="display text-6xl" style={{ color: CATEGORY_HEX.wildcard }}>
          {score}/{CHAIN_LENGTH}
        </p>
        <p className="text-sm text-muted">
          {score === CHAIN_LENGTH
            ? "The whole thread — not a knot missed."
            : score >= CHAIN_LENGTH / 2
            ? "A fine unravelling."
            : "The thread tangled. Come back tomorrow."}
        </p>
        <div className="flex gap-3 mt-2">
          {nodes.map((n, i) => (
            <span key={i} className="text-lg">
              {n.state === "correct" ? "🟩" : "🟥"}
            </span>
          ))}
        </div>
        <p className="microlabel mt-2 text-smoke">
          ✦ parlor · the thread · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </motion.div>
    );
  }

  const current = nodes[active];
  const hex = CATEGORY_HEX[current.question.category];

  return (
    <div className="mx-auto max-w-2xl">
      {/* Chain visual */}
      <div className="mb-8 flex items-center justify-center gap-1 sm:gap-2">
        {nodes.map((n, i) => {
          const nodeHex = CATEGORY_HEX[n.question.category];
          const isActive = i === active;
          const isPast = i < active;
          return (
            <div key={i} className="flex items-center gap-1 sm:gap-2">
              {/* Chain link dot */}
              <motion.div
                className="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold"
                style={{
                  borderColor: isPast
                    ? n.state === "correct"
                      ? "#2d9155"
                      : "#b22b2b"
                    : isActive
                    ? nodeHex
                    : "#1a1a2e",
                  background: isPast
                    ? n.state === "correct"
                      ? "#2d915533"
                      : "#b22b2b33"
                    : isActive
                    ? `${nodeHex}22`
                    : "transparent",
                  color: isActive ? nodeHex : isPast ? "#f0ede6" : "#4a4a6a",
                }}
                animate={isActive ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                {isPast
                  ? n.state === "correct"
                    ? "✓"
                    : "✗"
                  : String(i + 1)}
              </motion.div>
              {/* Connector thread */}
              {i < CHAIN_LENGTH - 1 && (
                <div
                  className="h-px w-3 sm:w-5"
                  style={{
                    background:
                      i < active
                        ? nodes[i].state === "correct"
                          ? "#2d9155"
                          : "#b22b2b"
                        : "#1a1a2e",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
          style={{ boxShadow: `0 0 40px ${hex}15` }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="microlabel" style={{ color: hex }}>
              {current.question.category}
            </span>
            <span className="microlabel">
              {active + 1} / {CHAIN_LENGTH}
            </span>
          </div>

          <p className="mt-3 text-lg font-medium leading-snug text-ink sm:text-xl">
            {current.question.prompt}
          </p>

          <div className="mt-6 flex gap-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuess()}
              placeholder="your answer…"
              className="flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-muted focus:border-brass focus:outline-none"
            />
            <button
              onClick={handleGuess}
              disabled={!input.trim()}
              className="microlabel rounded-xl border border-line bg-surface px-5 py-3 transition hover:border-brass disabled:opacity-40"
              style={{ color: hex }}
            >
              link →
            </button>
          </div>

          {/* Skip / reveal */}
          <button
            onClick={() => {
              const updated = nodes.map((n, i) =>
                i === active ? { ...n, state: "revealed" as const } : n,
              );
              sfxWrong();
              setNodes(updated);
              setInput("");
              if (active + 1 >= CHAIN_LENGTH) {
                sfxPianoChord();
                setDone(true);
              } else {
                setActive((a) => a + 1);
              }
            }}
            className="microlabel mt-3 text-smoke hover:text-muted transition"
          >
            reveal answer
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Previous node revealed answer */}
      {active > 0 && nodes[active - 1].state !== "pending" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 rounded-xl border border-line bg-surface/50 px-5 py-3"
        >
          <span className="microlabel text-smoke">previous link · </span>
          <span className="text-sm" style={{ color: CATEGORY_HEX[nodes[active - 1].question.category] }}>
            {nodes[active - 1].question.correct}
          </span>
        </motion.div>
      )}
    </div>
  );
}
