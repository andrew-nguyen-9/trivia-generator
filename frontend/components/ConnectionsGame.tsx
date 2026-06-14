"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { CATEGORY_HEX, type ConnectionGroup, type Question } from "@/lib/types";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { daySeed, mulberry32, shuffled } from "@/lib/rng";
import Confetti from "@/components/Confetti";
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";

const MAX_MISTAKES = 4;
// group difficulty 1..4 → the classic yellow/green/blue/purple ramp
const TIER_HEX = ["#ffb43a", "#3ddc84", "#4f9dff", "#b07aff"];

interface Tile {
  text: string;
  group: number;
}

export default function ConnectionsGame({
  puzzles,
}: {
  puzzles: Question[];
}) {
  const { record } = useProfile();
  const shake = useAnimationControls();
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [seedBump, setSeedBump] = useState(0);

  const puzzle = puzzles[puzzleIdx % Math.max(puzzles.length, 1)];
  const groups: ConnectionGroup[] = useMemo(
    () => puzzle?.groups ?? [],
    [puzzle],
  );

  const buildTiles = useCallback((): Tile[] => {
    const all: Tile[] = [];
    groups.forEach((g, gi) =>
      g.members.forEach((m) => all.push({ text: m, group: gi })),
    );
    return shuffled(all, mulberry32(daySeed() + seedBump));
  }, [groups, seedBump]);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState("");
  const [burst, setBurst] = useState(0);
  const [toasts, setToasts] = useState<Achievement[]>([]);

  const reset = useCallback(() => {
    setTiles(buildTiles());
    setSelected([]);
    setSolved([]);
    setMistakes(0);
    setHint("");
  }, [buildTiles]);

  useEffect(() => {
    reset();
  }, [reset]);

  const lost = mistakes >= MAX_MISTAKES;
  const won = solved.length === groups.length && groups.length > 0;
  const over = lost || won;
  const recorded = useRef(false);

  // a new puzzle/shuffle clears the "already recorded" guard
  useEffect(() => {
    recorded.current = false;
  }, [puzzleIdx, seedBump]);

  useEffect(() => {
    if (!over || recorded.current) return;
    recorded.current = true;
    if (won) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({
      room: "connections",
      score: solved.length,
      xp: solved.length * 200 + (won ? 200 : 0),
    });
    if (unlocked.length) setToasts(unlocked);
  }, [over, won, solved.length, record, recorded]);

  function toggle(text: string) {
    if (over) return;
    setHint("");
    setSelected((sel) =>
      sel.includes(text)
        ? sel.filter((t) => t !== text)
        : sel.length < 4
          ? [...sel, text]
          : sel,
    );
    sfx.select();
  }

  function submit() {
    if (selected.length !== 4) return;
    const gi = tiles.find((t) => t.text === selected[0])?.group;
    const counts = new Map<number, number>();
    for (const s of selected) {
      const g = tiles.find((t) => t.text === s)!.group;
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const allSame = gi !== undefined && counts.get(gi) === 4;

    if (allSame) {
      setSolved((s) => [...s, gi!]);
      setSelected([]);
      sfx.correct();
      haptic.correct();
    } else {
      setMistakes((m) => m + 1);
      const max = Math.max(...counts.values());
      if (max === 3) setHint("One away…");
      sfx.wrong();
      haptic.wrong();
      shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.3 } });
    }
  }

  function nextPuzzle() {
    setSelected([]);
    setSolved([]);
    setMistakes(0);
    setHint("");
    setSeedBump((s) => s + 1);
    setPuzzleIdx((p) => p + 1);
  }

  if (puzzles.length === 0 || groups.length < 4) {
    return <p className="text-muted">The bank is still warming up — no puzzles yet.</p>;
  }

  // remaining (unsolved) tiles, with solved rows lifted to the top
  const solvedRows = solved.map((gi) => ({ gi, group: groups[gi] }));
  const remaining = tiles.filter((t) => !solved.includes(t.group));

  return (
    <>
      <Confetti trigger={burst} />
      <AchievementToast queue={toasts} />
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Connections</h1>
        <div className="text-right">
          <div className="microlabel">mistakes</div>
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_MISTAKES }).map((_, k) => (
              <span
                key={k}
                className="h-3 w-3 rounded-full"
                style={{ background: k < mistakes ? "#ff4fa3" : "#26263a" }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="microlabel mt-4">{puzzle.prompt}</p>

      {/* solved groups */}
      <div className="mt-4 space-y-2">
        {solvedRows.map(({ gi, group }) => (
          <motion.div
            key={gi}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl p-3 text-center"
            style={{ background: `${TIER_HEX[(group.difficulty ?? 1) - 1]}22`, border: `1px solid ${TIER_HEX[(group.difficulty ?? 1) - 1]}` }}
          >
            <p className="microlabel" style={{ color: TIER_HEX[(group.difficulty ?? 1) - 1] }}>
              {group.label}
            </p>
            <p className="mt-1 font-bold">{group.members.join(" · ")}</p>
          </motion.div>
        ))}
      </div>

      {/* tile grid */}
      {!over && (
        <motion.div animate={shake} className="mt-3 grid grid-cols-4 gap-2">
          {remaining.map((t) => {
            const sel = selected.includes(t.text);
            return (
              <button
                key={t.text}
                onClick={() => toggle(t.text)}
                className={`flex min-h-16 items-center justify-center rounded-lg border px-1 py-2 text-center text-xs font-black uppercase leading-tight tracking-tight transition sm:text-sm ${
                  sel
                    ? "border-ink bg-ink text-bg"
                    : "border-line bg-surface hover:border-ink"
                }`}
              >
                {t.text}
              </button>
            );
          })}
        </motion.div>
      )}

      {hint && <p className="microlabel mt-3 text-center text-music">{hint}</p>}

      {!over ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={() => setSelected([])}
            disabled={selected.length === 0}
            className="microlabel rounded-full border border-line px-5 py-2.5 transition enabled:hover:border-ink disabled:opacity-30"
          >
            deselect
          </button>
          <button
            onClick={submit}
            disabled={selected.length !== 4}
            className="microlabel rounded-full border border-wildcard px-6 py-2.5 text-wildcard transition enabled:hover:bg-wildcard enabled:hover:text-bg disabled:opacity-30"
          >
            submit ({selected.length}/4)
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center text-center">
          <p className="display text-3xl" style={{ color: won ? "#3ddc84" : "#ff4fa3" }}>
            {won ? "Solved it!" : "Out of guesses"}
          </p>
          {/* reveal any unsolved groups on a loss */}
          {!won && (
            <div className="mt-3 w-full space-y-2">
              {groups
                .map((g, gi) => ({ g, gi }))
                .filter(({ gi }) => !solved.includes(gi))
                .map(({ g, gi }) => (
                  <div
                    key={gi}
                    className="rounded-xl border border-line p-3 text-center"
                  >
                    <p className="microlabel" style={{ color: TIER_HEX[(g.difficulty ?? 1) - 1] }}>
                      {g.label}
                    </p>
                    <p className="mt-1 font-bold">{g.members.join(" · ")}</p>
                  </div>
                ))}
            </div>
          )}
          <LeaderboardPanel room="connections" score={solved.length} accent="wildcard" />
          <button
            onClick={nextPuzzle}
            className="microlabel mt-6 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
          >
            {puzzles.length > 1 ? "another puzzle" : "shuffle & retry"}
          </button>
        </div>
      )}
    </>
  );
}
