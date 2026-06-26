"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { buildBoardColumns, type BoardColumn } from "@/lib/board";
import { CATEGORY_HEX, CATEGORY_LABEL, type Category, type Question } from "@/lib/types";
import { liberalMatch } from "@/lib/fuzzy";
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
import { BOARD_HOST, themedLabel, type BoardTheme } from "@/lib/themes";
import { TEXT_SIZE_CLASS, useBoardSettings } from "@/lib/boardSettings";
import { buildShare, type Tier } from "@/lib/share";
import styles from "./BoardGame.module.css";

type CellState = "fresh" | "right" | "wrong";
type GameMode = "easy" | "hard";

// Prompt scale per text-size setting (the body chrome uses TEXT_SIZE_CLASS).
const PROMPT_SIZE = { S: "text-lg sm:text-xl", M: "text-xl sm:text-2xl", L: "text-2xl sm:text-3xl" };

// Local YYYY-MM-DD for the share card's day-seed line (matches the daily board).
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BoardGame({
  columns: dailyColumns,
  dailyDouble: dailyDD,
  clues,
  theme,
}: {
  columns: BoardColumn[];
  dailyDouble: [number, number];
  clues?: Question[];
  theme: BoardTheme;
}) {
  const osReduced = useReducedMotion();
  const { settings, update } = useBoardSettings();
  const reduced = osReduced || settings.reducedMotion; // OS pref OR explicit toggle
  const [showSettings, setShowSettings] = useState(false);
  const [clueRevealed, setClueRevealed] = useState(false); // blur-clue sharpened?
  const { practiceMode, togglePractice, saved, saveQ, removeQ, isSaved } = usePractice();
  const { record } = useProfile();
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [burst, setBurst] = useState(0);
  const recorded = useRef(false);
  const stats = useRef<Partial<Record<Category, { correct: number; total: number }>>>({});

  // Board state
  const [mode, setMode] = useState<GameMode>("easy");
  const [score, setScore] = useState(0);
  const [open, setOpen] = useState<[number, number] | null>(null);
  const [states, setStates] = useState<Record<string, CellState>>({});

  // Daily-double wager: when a DD cell opens we stop on a wager step before the
  // clue. Cap is Jeopardy-style — the greater of your score or the board's top
  // value (1000) — so you can always bet at least 1000.
  const [wagerStep, setWagerStep] = useState(false);
  const [wager, setWager] = useState(1000);

  // Easy-mode choices (generated fresh on each cell open, safe: click handler)
  const [choices, setChoices] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  // Hard-mode text input
  const [textAnswer, setTextAnswer] = useState("");

  // Shared post-judge result (null = pre-judge; true/false = result)
  const [judgeResult, setJudgeResult] = useState<boolean | null>(null);

  // Share feedback ("copied!" when the Web Share sheet isn't available)
  const [shareMsg, setShareMsg] = useState("");

  // Practice: override today's board with a randomly generated one
  const [practiceColumns, setPracticeColumns] = useState<BoardColumn[] | null>(null);
  const [practiceDD, setPracticeDD] = useState<[number, number] | null>(null);

  const columns = practiceColumns ?? dailyColumns;
  const dailyDouble = practiceDD ?? dailyDD;

  // Roving keyboard focus over the 5×5 value grid.
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Move focus into the question overlay when it opens so keyboard/SR users land
  // on the prompt instead of being stranded on the tile behind it.
  const dialogRef = useRef<HTMLDivElement>(null);

  const cellKey = (c: number, r: number) => `${c}:${r}`;
  const isDD = (c: number, r: number) => dailyDouble[0] === c && dailyDouble[1] === r;
  const cellValue = (r: number) => (r + 1) * 200;
  const wagerCap = () => Math.max(1000, score);

  const played = Object.keys(states).length;
  const total = columns.length * 5;
  const openQ = open ? columns[open[0]].cells[open[1]] : null;
  const cleared = played === total && total > 0;

  useEffect(() => {
    if (open && !wagerStep) dialogRef.current?.focus();
  }, [open, wagerStep]);

  useEffect(() => {
    if (!cleared || recorded.current) return;
    recorded.current = true;
    if (score > 0) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({
      room: "board",
      score: Math.max(0, score),
      xp: Math.max(0, score) / 5,
      perCategory: stats.current,
    });
    if (unlocked.length) setToasts(unlocked);
  }, [cleared, score, record]);

  function openCell(c: number, r: number) {
    setOpen([c, r]);
    setPicked(null);
    setJudgeResult(null);
    setTextAnswer("");
    setClueRevealed(false);
    setWagerStep(isDD(c, r));
    if (isDD(c, r)) setWager(Math.min(wagerCap(), 1000));

    if (mode === "easy") {
      const cell = columns[c].cells[r];
      const correct = cell.correct;
      // Prefer the forge's same-category distractors (sampled from the whole
      // category, so they read as plausible alternatives). Fall back to other
      // answers in THIS column (also same category), then any board answer —
      // always deduped so the options can't collapse into repeats.
      if (cell.choices && cell.choices.length >= 2) {
        setChoices(cell.choices);
      } else {
        const seen = new Set([correct.trim().toLowerCase()]);
        const pool: string[] = [];
        const sameCol = columns[c].cells.map((x) => x.correct);
        const rest = columns.flatMap((col) => col.cells.map((x) => x.correct));
        for (const ans of [...sameCol, ...rest]) {
          const k = ans.trim().toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          pool.push(ans);
        }
        const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3);
        setChoices([...distractors, correct].sort(() => Math.random() - 0.5));
      }
    }
  }

  function judge(correct: boolean) {
    if (!open) return;
    const [c, r] = open;
    const stake = isDD(c, r) ? wager : cellValue(r);
    const cat = columns[c].cells[r].category;
    const st = stats.current[cat] ?? { correct: 0, total: 0 };
    stats.current[cat] = { correct: st.correct + (correct ? 1 : 0), total: st.total + 1 };
    setStates((s) => ({ ...s, [cellKey(c, r)]: correct ? "right" : "wrong" }));
    setScore((s) => s + (correct ? stake : -stake));
    setJudgeResult(correct);
    if (correct) {
      sfx.correct();
      haptic.correct();
    } else {
      sfx.wrong();
      haptic.wrong();
    }
  }

  function closeModal() {
    setOpen(null);
    setPicked(null);
    setJudgeResult(null);
    setTextAnswer("");
    setWagerStep(false);
  }

  // Arrow-key navigation across the value grid; Enter/Space open via the button.
  function onGridKey(e: React.KeyboardEvent) {
    const [c, r] = cursor;
    let nc = c;
    let nr = r;
    if (e.key === "ArrowRight") nc = Math.min(columns.length - 1, c + 1);
    else if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
    else if (e.key === "ArrowDown") nr = Math.min(4, r + 1);
    else if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
    else return;
    e.preventDefault();
    setCursor([nc, nr]);
    tileRefs.current[cellKey(nc, nr)]?.focus();
  }

  // §3.1 social: a 5×5 colored grid of which clues hit/missed + final score.
  async function shareResult() {
    const tiers: Tier[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < columns.length; c++) {
        const st = states[cellKey(c, r)];
        tiers.push(st === "right" ? "hit" : st === "wrong" ? "miss" : "blank");
      }
    }
    const card = buildShare({
      room: "/board",
      date: todayISO(),
      tiers,
      score: Math.max(0, score),
      maxScore: columns.length * 3000, // 200+400+600+800+1000 per column
      columns: columns.length,
    });
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: card.title, text: card.text, url: card.url });
      } else {
        await navigator.clipboard.writeText(card.text);
        setShareMsg("copied!");
        setTimeout(() => setShareMsg(""), 2000);
      }
    } catch {
      /* user dismissed the share sheet, or clipboard blocked — no-op */
    }
  }

  function newPracticeBoard() {
    if (!clues || clues.length === 0) return;
    const cols = buildBoardColumns(
      clues,
      (arr) => arr[Math.floor(Math.random() * arr.length)],
    );
    const dd: [number, number] = [
      Math.floor(Math.random() * Math.max(1, cols.length)),
      Math.floor(Math.random() * 5),
    ];
    setPracticeColumns(cols);
    setPracticeDD(dd);
    setStates({});
    setScore(0);
    closeModal();
    recorded.current = false;
    stats.current = {};
  }

  return (
    <div>
      <h1 className="sr-only">Codex — the daily board</h1>
      <AchievementToast queue={toasts} />

      {/* Compact one-screen header: host nameplate · mode/settings · score · share */}
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg"
            style={{ borderColor: theme.accent, color: theme.accent }}
            aria-hidden
          >
            {theme.glyph}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="display truncate text-base" style={{ color: theme.accent }}>
              {BOARD_HOST.name}
            </div>
            <div className="microlabel truncate text-muted">tonight: {theme.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {practiceMode && clues && clues.length > 0 && (
            <button
              onClick={newPracticeBoard}
              className="microlabel rounded-full border border-wildcard px-3 py-1 text-wildcard transition hover:bg-wildcard hover:text-bg"
            >
              ↻ new
            </button>
          )}

          {/* mode toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode("easy")}
              className={`microlabel rounded-full border px-2.5 py-1 transition ${
                mode === "easy" ? "border-sports text-sports" : "border-line text-muted hover:border-ink"
              }`}
            >
              easy
            </button>
            <button
              onClick={() => setMode("hard")}
              className={`microlabel rounded-full border px-2.5 py-1 transition ${
                mode === "hard" ? "border-music text-music" : "border-line text-muted hover:border-ink"
              }`}
            >
              hard
            </button>
          </div>

          {/* settings — popover, absolutely positioned so it never reflows the board */}
          <div className="relative">
            <button
              onClick={() => setShowSettings((s) => !s)}
              aria-label="settings"
              aria-expanded={showSettings}
              className={`rounded-full border px-2.5 py-1 text-base transition ${
                showSettings ? "border-gold text-gold" : "border-line text-muted hover:border-ink"
              }`}
            >
              ⚙
            </button>
            {showSettings && (
              <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-gold/40 bg-surface p-4 text-left shadow-xl">
                <div className="microlabel mb-3 text-gold">settings</div>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="microlabel mb-1 text-muted">text size</div>
                    <div className="flex gap-1">
                      {(["S", "M", "L"] as const).map((sz) => (
                        <button
                          key={sz}
                          onClick={() => update({ textSize: sz })}
                          className={`rounded-full border px-3 py-1 text-sm transition ${
                            settings.textSize === sz
                              ? "border-gold text-gold"
                              : "border-line text-muted hover:border-ink"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.hints}
                      onChange={(e) => update({ hints: e.target.checked })}
                      className="accent-gold"
                    />
                    <span className="microlabel text-muted">image hints</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.reducedMotion}
                      onChange={(e) => update({ reducedMotion: e.target.checked })}
                      className="accent-gold"
                    />
                    <span className="microlabel text-muted">reduce motion</span>
                  </label>
                  {osReduced && (
                    <p className="microlabel text-muted">
                      your system already requests reduced motion — honored.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* running score */}
          <div className="pl-1 text-right leading-none">
            <div className="microlabel text-muted">score</div>
            <div
              className={`tabular text-2xl font-black ${score < 0 ? "text-music" : "text-history"}`}
            >
              {score < 0 ? "−" : ""}${Math.abs(score).toLocaleString()}
            </div>
          </div>

          {/* share — live once the board is cleared */}
          <button
            onClick={shareResult}
            disabled={!cleared}
            className="microlabel rounded-full border border-history px-3 py-1 text-history transition enabled:hover:bg-history enabled:hover:text-bg disabled:opacity-30"
          >
            {shareMsg || "share"}
          </button>
        </div>
      </header>

      {/* Grid + in-place clue overlay (sized to the board, never the viewport) */}
      {columns.length < 5 ? (
        <p className="text-muted">
          The bank is still warming up — not enough clue categories yet.
        </p>
      ) : (
        <div className={styles.boardWrap}>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            className="grid grid-cols-5 gap-2"
            role="grid"
            aria-label="Codex value board — use arrow keys to navigate, Enter to open"
            onKeyDown={onGridKey}
          >
            {columns.map((col) => {
              const hex = CATEGORY_HEX[col.category];
              return (
                <div
                  key={col.category}
                  className="microlabel flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border bg-surface p-1.5 text-center"
                  style={{
                    color: hex,
                    borderColor: `${theme.accent}55`,
                    background: `linear-gradient(160deg, ${hex}1a, transparent)`,
                  }}
                >
                  <span className="text-sm opacity-70" style={{ color: theme.accent }} aria-hidden>
                    {theme.glyph}
                  </span>
                  <span>{themedLabel(theme, col.category, CATEGORY_LABEL[col.category])}</span>
                </div>
              );
            })}
            {[0, 1, 2, 3, 4].map((r) =>
              columns.map((col, c) => {
                const st = states[cellKey(c, r)];
                const isCursor = cursor[0] === c && cursor[1] === r;
                return (
                  <div key={cellKey(c, r)} className="flip-scene min-h-12 sm:min-h-14" role="gridcell">
                    <div className={`flip-inner h-full ${st ? "flipped" : ""}`}>
                      {/* front — the dollar value, click to open. The visible
                          label is just the value; the a11y name carries the
                          category + state so keyboard/SR users aren't navigating
                          25 identical "$200" tiles. */}
                      <button
                        ref={(el) => {
                          tileRefs.current[cellKey(c, r)] = el;
                        }}
                        disabled={Boolean(st)}
                        tabIndex={isCursor ? 0 : -1}
                        onFocus={() => setCursor([c, r])}
                        onClick={() => openCell(c, r)}
                        aria-label={`${themedLabel(theme, col.category, CATEGORY_LABEL[col.category])}, $${(r + 1) * 200}${st ? ` — answered ${st === "right" ? "correctly" : "incorrectly"}` : ""}`}
                        className={`${styles.tile} flip-face tabular absolute inset-0 flex items-center justify-center rounded-lg border border-line bg-surface text-base font-black text-history transition hover:border-history hover:bg-history/10 sm:text-xl`}
                      >
                        ${(r + 1) * 200}
                      </button>
                      {/* back — the result, revealed by the card flip */}
                      <div
                        className={`flip-face flip-back tabular absolute inset-0 flex items-center justify-center rounded-lg border text-base font-black sm:text-xl ${
                          st === "right"
                            ? "border-sports/40 bg-surface text-sports/60"
                            : "border-music/40 bg-surface text-music/60"
                        }`}
                      >
                        {st === "right" ? "✓" : "✗"}
                      </div>
                    </div>
                  </div>
                );
              }),
            )}
          </div>

          {/* The clue / wager overlay — covers only the board */}
          <AnimatePresence>
            {openQ && open && (
              <motion.div
                className={styles.clueOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {wagerStep ? (
                  /* Daily-double wager step — bet before the clue is shown */
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <span className="microlabel animate-pulse text-history">★ daily double</span>
                    <p className="display mt-2 text-2xl text-history">Place your wager</p>
                    <p className="microlabel mt-1 text-muted">
                      up to ${wagerCap().toLocaleString()}
                    </p>
                    <div
                      className={`tabular mt-4 text-4xl font-black ${score < 0 ? "text-music" : "text-history"}`}
                    >
                      ${wager.toLocaleString()}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={wagerCap()}
                      step={100}
                      value={wager}
                      onChange={(e) => setWager(Number(e.target.value))}
                      aria-label="wager amount"
                      className="mt-4 w-64 max-w-full accent-history"
                    />
                    <button
                      onClick={() => setWagerStep(false)}
                      className="microlabel mt-6 rounded-full border border-history px-8 py-3 text-history transition hover:bg-history hover:text-bg"
                    >
                      lock it in →
                    </button>
                  </div>
                ) : (
                  <motion.div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="board-q-prompt"
                    tabIndex={-1}
                    initial={reduced ? {} : { scale: 0.92 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className="m-auto w-full max-w-2xl p-5 outline-none sm:p-6"
                    style={{ borderColor: CATEGORY_HEX[openQ.category] }}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="microlabel" style={{ color: CATEGORY_HEX[openQ.category] }}>
                        {themedLabel(theme, openQ.category, CATEGORY_LABEL[openQ.category])} · $
                        {isDD(open[0], open[1]) ? wager : cellValue(open[1])}
                      </span>
                      {isDD(open[0], open[1]) && (
                        <span className="microlabel text-history">★ daily double · ${wager}</span>
                      )}
                    </div>

                    <p
                      id="board-q-prompt"
                      className={`display mt-3 leading-tight ${PROMPT_SIZE[settings.textSize]}`}
                    >
                      {openQ.prompt}
                    </p>

                    {/* Optional blur-reveal image clue (folded in from The Gallery).
                        Gated by the hint setting; sharpens on click or hover. */}
                    {settings.hints && openQ.image_url && judgeResult === null && (
                      <div className="mt-3 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setClueRevealed(true)}
                          onMouseEnter={() => setClueRevealed(true)}
                          className="relative overflow-hidden rounded-2xl border border-line bg-bg"
                          title={clueRevealed ? "" : "reveal image clue"}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={openQ.image_url}
                            alt="image clue"
                            className="h-28 w-auto max-w-full object-contain transition-[filter] duration-500 sm:h-32"
                            style={{ filter: `blur(${clueRevealed || reduced ? 0 : 16}px)` }}
                            draggable={false}
                          />
                          {!clueRevealed && !reduced && (
                            <span
                              className="pointer-events-none absolute bottom-2 right-3 microlabel"
                              style={{ color: theme.accent }}
                            >
                              tap to sharpen…
                            </span>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Post-judge result panel */}
                    {judgeResult !== null ? (
                      <div className="mt-5">
                        <p
                          className={`text-xl font-black ${judgeResult ? "text-sports" : "text-music"}`}
                        >
                          {judgeResult ? "✓ Correct!" : "✗ Missed it"}
                        </p>
                        {/* Always restate the answer — right or wrong, the player
                            should leave the clue knowing it. */}
                        <p className="mt-1 text-muted">
                          The answer:{" "}
                          <span className="font-black text-ink">What is {openQ.correct}?</span>
                        </p>
                        {openQ.source_url && (
                          <a
                            href={openQ.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="microlabel mt-2 block underline"
                          >
                            source
                          </a>
                        )}
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={closeModal}
                            className="microlabel rounded-full border border-ink px-6 py-2.5 transition hover:bg-ink hover:text-bg"
                          >
                            continue
                          </button>
                          {practiceMode && (
                            <button
                              onClick={() =>
                                isSaved(openQ) ? removeQ(openQ.prompt) : saveQ(openQ)
                              }
                              className={`microlabel rounded-full border px-6 py-2.5 transition ${
                                isSaved(openQ)
                                  ? "border-history text-history"
                                  : "border-line text-muted hover:border-history hover:text-history"
                              }`}
                            >
                              {isSaved(openQ) ? "★ saved" : "☆ save"}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : mode === "easy" ? (
                      /* Easy — multiple choice */
                      <div className={`mt-5 grid gap-2.5 sm:grid-cols-2 ${TEXT_SIZE_CLASS[settings.textSize]}`}>
                        {choices.map((choice) => {
                          const isCorrect = choice === openQ.correct;
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
                              disabled={Boolean(picked)}
                              onClick={() => {
                                setPicked(choice);
                                judge(choice === openQ.correct);
                              }}
                              className={`rounded-xl border p-3 text-left font-bold transition ${cls}`}
                            >
                              {choice}
                              {picked && isCorrect && " ✓"}
                              {picked && isPicked && !isCorrect && " ✗"}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Hard — free text with fuzzy matching */
                      <div className="mt-5">
                        <p className="microlabel mb-2 text-muted">
                          What is...? (spelling counts loosely)
                        </p>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && textAnswer.trim()) {
                                judge(liberalMatch(textAnswer, openQ.correct));
                              }
                            }}
                            placeholder="type your answer"
                            autoFocus
                            className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-ink outline-none focus:border-music"
                          />
                          <button
                            onClick={() => {
                              if (textAnswer.trim())
                                judge(liberalMatch(textAnswer, openQ.correct));
                            }}
                            disabled={!textAnswer.trim()}
                            className="microlabel rounded-full border border-music px-6 py-2.5 text-music transition enabled:hover:bg-music enabled:hover:text-bg disabled:opacity-30"
                          >
                            submit
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {cleared && (
        <div className="mt-5 flex flex-col items-center text-center">
          <Confetti trigger={burst} />
          <p className="display text-2xl text-history">
            Board cleared — final ${score.toLocaleString()}
          </p>
          <button
            onClick={shareResult}
            className="microlabel mt-3 rounded-full border border-history px-6 py-2.5 text-history transition hover:bg-history hover:text-bg"
          >
            {shareMsg || "share result"}
          </button>
          <LeaderboardPanel room="board" score={Math.max(0, score)} accent="history" />
        </div>
      )}

      <PracticeBar
        practiceMode={practiceMode}
        onToggle={togglePractice}
        saved={saved}
        onRemove={removeQ}
      />
    </div>
  );
}
