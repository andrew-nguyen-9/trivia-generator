"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { pickRotating } from "@/lib/rng";
import { CATEGORY_HEX, type Question, type ThreadLink } from "@/lib/types";
import { buildShare, type Tier } from "@/lib/share";
import { sfxCorrect, sfxWrong, sfxPianoChord, sfx } from "@/lib/sound";
import styles from "./ThreadGame.module.css";

// The Weaver / Seamstress of the Order hosts THE THREAD (character canon — see
// docs/v2/GAMES.md). Nameplate placeholder, mirrors lib/themes.ts BOARD_HOST.
const WEAVER = { name: "The Weaver", title: "Seamstress of the Order" };

const THREAD_HEX = CATEGORY_HEX.history; // brass thread

// A solved link is one of three tiers, reused verbatim by lib/share.ts:
//   hit  — solved clean (no hint)        🟩
//   near — solved, but a hint was spent  🟨   ← the hint's cost
//   miss — revealed / wrong              ⬛
type Resolved = "hit" | "near" | "miss";
type LinkState = "pending" | Resolved;

const KNOT: Record<LinkState | "active", string> = {
  pending: "#26263a",
  active: THREAD_HEX,
  hit: "#2d9155",
  near: "#c79a3a",
  miss: "#b22b2b",
};

interface Node {
  link: ThreadLink;
  state: LinkState;
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

/** The letter that actually passes the thread forward — last A-Z char, mirrors
 *  pipeline's _chain_key (forge_thread). More useful than a first-letter hint:
 *  it's the one piece every player needs to keep weaving. */
function passingLetter(answer: string): string {
  const letters = answer.replace(/[^a-zA-Z]/g, "");
  return (letters || answer).slice(-1).toUpperCase();
}

/** Forgiving match: trimmed equality, substring either way, or first-word hit. */
function isMatch(guess: string, answer: string): boolean {
  const g = guess.trim().toLowerCase();
  const a = answer.toLowerCase();
  return (
    g.length > 1 &&
    (g === a || a.includes(g) || g.includes(a.split(" ")[0]))
  );
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

  const [nodes, setNodes] = useState<Node[]>(
    chain.map((link) => ({ link, state: "pending" })),
  );
  const [active, setActive] = useState(0);
  const [input, setInput] = useState("");
  const [hintUsed, setHintUsed] = useState(false);
  const [phase, setPhase] = useState<"chain" | "final" | "done">("chain");
  const [themeGuess, setThemeGuess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  function resolve(state: Resolved) {
    setNodes((ns) => ns.map((n, i) => (i === active ? { ...n, state } : n)));
    setInput("");
    setHintUsed(false);
    if (active + 1 >= chain.length) {
      sfxPianoChord();
      setPhase("final");
    } else {
      setActive((a) => a + 1);
    }
  }

  function handleGuess() {
    if (nodes[active]?.state !== "pending") return;
    if (!isMatch(input, nodes[active].link.answer)) {
      sfxWrong();
      resolve("miss"); // a wrong guess unravels the link — the answer is shown
      return;
    }
    sfxCorrect();
    resolve(hintUsed ? "near" : "hit"); // a spent hint downgrades hit → near
  }

  // The hint costs: it spends the clean-solve tier (hit → near) and shows the
  // answer's PASSING letter (its final A-Z char — the one the chain actually
  // needs to keep weaving) rather than its first, which is the more useful
  // half of the puzzle once a player is stuck.
  function hint() {
    if (nodes[active]?.state !== "pending" || hintUsed) return;
    sfx.tick();
    setHintUsed(true);
    inputRef.current?.focus();
  }

  function reveal() {
    if (nodes[active]?.state !== "pending") return;
    sfxWrong();
    resolve("miss");
  }

  function guessTheme(choice: string) {
    setThemeGuess(choice);
    if (choice === theme) sfxCorrect();
    else sfxWrong();
    setPhase("done");
  }

  const solved = nodes.filter((n) => n.state === "hit" || n.state === "near").length;
  const clean = nodes.filter((n) => n.state === "hit").length;
  const themeRight = themeGuess === theme;
  const solvedPct = Math.round((solved / chain.length) * 100);

  // Share via the canonical seam (lib/share.ts): one tier per link + a trailing
  // square for the theme guess, on one row. The headline is the solved-% chain.
  function threadCard() {
    const date = new Date().toISOString().slice(0, 10);
    const tiers: Tier[] = [
      ...nodes.map((n) => (n.state === "pending" ? "miss" : n.state) as Tier),
      themeRight ? "hit" : "miss",
    ];
    return buildShare({
      room: "/thread",
      date,
      tiers,
      score: solved,
      maxScore: chain.length,
      columns: chain.length + 1,
    });
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(threadCard().text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the grid is on screen anyway */
    }
  }

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
        <span className="microlabel tabular" style={{ color: THREAD_HEX }}>
          {phase === "chain"
            ? `link ${active + 1} / ${chain.length}`
            : `${solved}/${chain.length} woven`}
        </span>
      </div>

      {/* THE RAIL — every link, resolved ones revealed in place, the active one
          expanded with its input. This single list is the whole game. */}
      <div className={styles.rail}>
        {nodes.map((n, i) => {
          const isActive = phase === "chain" && i === active;
          const knot =
            n.state === "pending" ? (isActive ? KNOT.active : KNOT.pending) : KNOT[n.state];
          const done = n.state !== "pending";
          const future = n.state === "pending" && !isActive;
          return (
            <div key={i} className={styles.link} style={{ ["--knot" as string]: knot }}>
              <span className={`${styles.knot} ${done ? styles.knotDone : ""}`}>
                {n.state === "hit" ? "✓" : n.state === "near" ? "◆" : n.state === "miss" ? "✕" : i + 1}
              </span>

              <div className={styles.body}>
                {future && (
                  <p className="py-1 text-sm text-smoke">
                    link {i + 1} — not yet spun
                  </p>
                )}

                {done && (
                  <>
                    <p className="font-medium leading-snug text-ink">
                      {n.link.answer}
                    </p>
                    <p className={`${styles.tie} microlabel mt-0.5 text-smoke`}>
                      {n.link.link}
                    </p>
                  </>
                )}

                {isActive && (
                  <motion.div
                    key={`active-${i}`}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-lg font-medium leading-snug text-ink">
                      {n.link.prompt}
                    </p>
                    {hintUsed && (
                      <p className={`${styles.hintChip} microlabel mt-2`} style={{ color: THREAD_HEX }}>
                        hint · passes the thread on “{passingLetter(n.link.answer)}…”
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                        placeholder="your answer…"
                        className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-ink placeholder:text-muted focus:border-brass focus:outline-none"
                      />
                      <button
                        onClick={handleGuess}
                        disabled={!input.trim()}
                        className="microlabel rounded-xl border border-line bg-surface px-4 py-2.5 transition hover:border-brass disabled:opacity-40"
                        style={{ color: THREAD_HEX }}
                      >
                        stitch →
                      </button>
                    </div>
                    <div className="mt-2 flex gap-4">
                      <button
                        onClick={hint}
                        disabled={hintUsed}
                        className="microlabel text-smoke transition hover:text-muted disabled:opacity-40"
                      >
                        {hintUsed ? "hint spent" : "hint (costs a clean stitch)"}
                      </button>
                      <button
                        onClick={reveal}
                        className="microlabel text-smoke transition hover:text-muted"
                      >
                        reveal answer
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* the final stitch + the reveal live at the foot of the same rail */}
      <AnimatePresence mode="wait">
        {phase === "final" && (
          <motion.div
            key="final"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-2xl border border-line bg-surface p-5 text-center"
            style={{ boxShadow: `0 0 50px ${THREAD_HEX}22` }}
          >
            <p className="microlabel tracking-widest" style={{ color: THREAD_HEX }}>
              the final stitch
            </p>
            <p className="mt-2 text-lg font-medium text-ink">{puzzle.prompt}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-center"
            style={{ boxShadow: `0 0 50px ${THREAD_HEX}22` }}
          >
            <p className="microlabel tracking-widest text-brass">thread woven</p>
            <p className="display text-3xl" style={{ color: THREAD_HEX }}>
              {theme}
            </p>
            <pre className="whitespace-pre text-center text-lg leading-none tracking-widest">
              {threadCard().grid}
            </pre>
            <p className="text-sm text-muted">
              {solvedPct}% woven · {clean} clean · theme {themeRight ? "found" : "missed"}
            </p>
            <button
              onClick={share}
              className="microlabel rounded-full border px-6 py-2.5 transition"
              style={{ borderColor: THREAD_HEX, color: THREAD_HEX }}
            >
              {copied ? "copied ✓" : "share the thread"}
            </button>
            <p className="microlabel text-smoke">
              ✦ parlor · the thread ·{" "}
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
