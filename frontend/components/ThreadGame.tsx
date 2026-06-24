"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { pickRotating } from "@/lib/rng";
import { CATEGORY_HEX, type Question, type ThreadLink } from "@/lib/types";
import { sfxCorrect, sfxWrong, sfxPianoChord } from "@/lib/sound";

// The Weaver / Seamstress of the Order hosts THE THREAD (character canon — see
// docs/v2/GAMES.md). Nameplate placeholder, mirrors lib/themes.ts BOARD_HOST.
const WEAVER = { name: "The Weaver", title: "Seamstress of the Order" };

const THREAD_HEX = CATEGORY_HEX.history; // brass thread

interface LinkState {
  link: ThreadLink;
  state: "pending" | "correct" | "revealed";
}

/** Build a fallback chain from raw clue questions when no forged thread exists,
 *  so the room is never empty. # ponytail: fallback links share no real theme —
 *  the master theme is a generic placeholder; the forged thread is the real game. */
function fallbackThread(clues: Question[]): Question | null {
  const picked = pickRotating(clues, 5);
  if (picked.length < 3) return null;
  return {
    qtype: "thread",
    category: "history",
    difficulty: 3,
    prompt: "What is the thread that ties them all together?",
    correct: "The Archive",
    theme: "The Archive",
    theme_choices: ["The Archive", "The Voyage", "The Cosmos", "Egypt"],
    chain: picked.map((q) => ({
      prompt: q.prompt,
      answer: q.correct,
      link: "Drawn from the same nightly archive.",
    })),
  };
}

export default function ThreadGame({
  threads,
  clues,
}: {
  threads: Question[];
  clues: Question[];
}) {
  const reduced = useReducedMotion();

  // Date-seeded daily pick among the available forged threads (SSR/client agree).
  const puzzle = useMemo<Question | null>(() => {
    if (threads.length) return pickRotating(threads, 1)[0] ?? null;
    return fallbackThread(clues);
  }, [threads, clues]);

  const chain = puzzle?.chain ?? [];
  const themeChoices = puzzle?.theme_choices ?? [];
  const theme = puzzle?.theme ?? puzzle?.correct ?? "";

  const [links, setLinks] = useState<LinkState[]>(
    chain.map((link) => ({ link, state: "pending" })),
  );
  const [active, setActive] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"chain" | "final" | "done">("chain");
  const [themeGuess, setThemeGuess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "chain") inputRef.current?.focus();
  }, [active, phase]);

  if (!puzzle || chain.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">🧵</p>
        <p className="text-muted">The thread is not yet spun.</p>
        <p className="microlabel">check back once the nightly forge runs</p>
      </div>
    );
  }

  function advance(updated: LinkState[]) {
    setLinks(updated);
    setInput("");
    if (active + 1 >= chain.length) {
      sfxPianoChord();
      setPhase("final");
    } else {
      setActive((a) => a + 1);
    }
  }

  function handleGuess() {
    const node = links[active];
    if (!node || node.state !== "pending") return;
    const guess = input.trim().toLowerCase();
    const answer = node.link.answer.toLowerCase();
    const isCorrect =
      guess.length > 1 &&
      (guess === answer ||
        answer.includes(guess) ||
        guess.includes(answer.split(" ")[0]));

    const next = links.map((n, i) =>
      i === active
        ? { ...n, state: (isCorrect ? "correct" : "revealed") as LinkState["state"] }
        : n,
    );
    if (isCorrect) {
      sfxCorrect();
      setScore((s) => s + 1);
    } else {
      sfxWrong();
    }
    advance(next);
  }

  function reveal() {
    const node = links[active];
    if (!node || node.state !== "pending") return;
    sfxWrong();
    advance(
      links.map((n, i) =>
        i === active ? { ...n, state: "revealed" as const } : n,
      ),
    );
  }

  function guessTheme(choice: string) {
    setThemeGuess(choice);
    if (choice === theme) sfxCorrect();
    else sfxWrong();
    setPhase("done");
  }

  const solved = links.filter((l) => l.state === "correct").length;
  const themeRight = themeGuess === theme;

  // ── the woven thread: a stitched seam across every link (SVG, no libs) ──
  const w = 320;
  const stitch = w / Math.max(chain.length, 1);
  const seam = (
    <svg
      viewBox={`0 0 ${w} 28`}
      className="mx-auto mb-6 h-7 w-full max-w-md"
      aria-hidden
    >
      {/* base thread */}
      <line x1={6} y1={14} x2={w - 6} y2={14} stroke="#1a1a2e" strokeWidth={2} />
      {links.map((n, i) => {
        const cx = stitch * i + stitch / 2;
        const done = n.state !== "pending";
        const col = n.state === "correct" ? "#2d9155" : n.state === "revealed" ? "#b22b2b" : THREAD_HEX;
        return (
          <g key={i}>
            {/* stitch dash to the previous knot */}
            {i > 0 && (
              <line
                x1={stitch * (i - 1) + stitch / 2}
                y1={14}
                x2={cx}
                y2={14}
                stroke={links[i - 1].state !== "pending" ? col : "#1a1a2e"}
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            )}
            <motion.circle
              cx={cx}
              cy={14}
              r={done ? 5 : i === active ? 5 : 3}
              fill={done || i === active ? col : "#26263a"}
              animate={!reduced && i === active && phase === "chain" ? { r: [4, 6, 4] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          </g>
        );
      })}
      {/* the needle, riding the active knot, pulling thread along */}
      {phase === "chain" && (
        <motion.g
          animate={{ x: stitch * active + stitch / 2 }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18 }}
        >
          <line x1={-9} y1={5} x2={2} y2={14} stroke={THREAD_HEX} strokeWidth={2} />
          <circle cx={-9} cy={5} r={2} fill="none" stroke={THREAD_HEX} strokeWidth={1.4} />
        </motion.g>
      )}
    </svg>
  );

  return (
    <div className="mx-auto max-w-2xl">
      {/* Weaver nameplate */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-70" style={{ color: THREAD_HEX }}>
            🧵
          </span>
          <div>
            <p className="text-sm font-medium text-ink">{WEAVER.name}</p>
            <p className="microlabel text-smoke">{WEAVER.title}</p>
          </div>
        </div>
        <span className="microlabel">
          {phase === "chain" ? `${active + 1} / ${chain.length}` : "the reveal"}
        </span>
      </div>

      {seam}

      <AnimatePresence mode="wait">
        {phase === "chain" && (
          <motion.div
            key={`link-${active}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
            style={{ boxShadow: `0 0 40px ${THREAD_HEX}15` }}
          >
            <span className="microlabel" style={{ color: THREAD_HEX }}>
              link {active + 1}
            </span>
            <p className="mt-3 text-lg font-medium leading-snug text-ink sm:text-xl">
              {links[active].link.prompt}
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
                style={{ color: THREAD_HEX }}
              >
                stitch →
              </button>
            </div>
            <button
              onClick={reveal}
              className="microlabel mt-3 text-smoke transition hover:text-muted"
            >
              reveal answer
            </button>
          </motion.div>
        )}

        {phase === "final" && (
          <motion.div
            key="final"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-line bg-surface p-6 text-center sm:p-8"
            style={{ boxShadow: `0 0 50px ${THREAD_HEX}22` }}
          >
            <p className="microlabel tracking-widest" style={{ color: THREAD_HEX }}>
              the final stitch
            </p>
            <p className="mt-3 text-xl font-medium text-ink">
              {puzzle.prompt}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {themeChoices.map((c) => (
                <button
                  key={c}
                  onClick={() => guessTheme(c)}
                  className="rounded-xl border border-line bg-bg px-4 py-3 text-ink transition hover:border-brass"
                >
                  {c}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5 text-center"
          >
            <p className="microlabel tracking-widest text-brass">thread woven</p>
            <p className="display text-4xl" style={{ color: THREAD_HEX }}>
              {theme}
            </p>
            <p className="text-sm text-muted">
              {themeRight
                ? "You named the thread — every stitch ties to it."
                : `The thread was ${theme}. A near miss.`}
            </p>
            <div className="flex gap-2">
              {links.map((n, i) => (
                <span key={i} className="text-lg">
                  {n.state === "correct" ? "🟩" : "🟥"}
                </span>
              ))}
              <span className="text-lg">{themeRight ? "🧵" : "✂️"}</span>
            </div>
            <p className="text-sm text-muted">
              {solved}/{chain.length} links · theme {themeRight ? "found" : "missed"}
            </p>

            {/* the finished seam, with each link and its tie-explanation */}
            <div className="mt-2 w-full space-y-2 text-left">
              {links.map((n, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-line bg-surface/60 px-4 py-3"
                >
                  <p className="font-medium text-ink">
                    <span className="microlabel mr-2 text-smoke">{i + 1}.</span>
                    {n.link.answer}
                  </p>
                  <p className="microlabel mt-1 text-smoke">{n.link.link}</p>
                </div>
              ))}
            </div>

            <p className="microlabel mt-2 text-smoke">
              ✦ parlor · the thread ·{" "}
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
