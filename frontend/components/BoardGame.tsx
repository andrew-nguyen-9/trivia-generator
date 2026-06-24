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

type CellState = "fresh" | "right" | "wrong";
type GameMode = "easy" | "hard";

// Prompt scale per text-size setting (the body chrome uses TEXT_SIZE_CLASS).
const PROMPT_SIZE = { S: "text-xl sm:text-2xl", M: "text-2xl sm:text-3xl", L: "text-3xl sm:text-4xl" };

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

  // Easy-mode choices (generated fresh on each cell open, safe: click handler)
  const [choices, setChoices] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  // Hard-mode text input
  const [textAnswer, setTextAnswer] = useState("");

  // Shared post-judge result (null = pre-judge; true/false = result)
  const [judgeResult, setJudgeResult] = useState<boolean | null>(null);

  // Practice: override today's board with a randomly generated one
  const [practiceColumns, setPracticeColumns] = useState<BoardColumn[] | null>(null);
  const [practiceDD, setPracticeDD] = useState<[number, number] | null>(null);

  const columns = practiceColumns ?? dailyColumns;
  const dailyDouble = practiceDD ?? dailyDD;

  // Move focus into the question dialog when it opens so keyboard/SR users land
  // on the prompt instead of being stranded on the (now-disabled) tile behind
  // the backdrop. role=dialog + aria-modal on the card does the announcing.
  const dialogRef = useRef<HTMLDivElement>(null);

  const cellKey = (c: number, r: number) => `${c}:${r}`;
  const isDD = (c: number, r: number) => dailyDouble[0] === c && dailyDouble[1] === r;
  const cellValue = (r: number, c: number) => (r + 1) * 200 * (isDD(c, r) ? 2 : 1);

  const played = Object.keys(states).length;
  const total = columns.length * 5;
  const openQ = open ? columns[open[0]].cells[open[1]] : null;
  const cleared = played === total && total > 0;

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

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

    if (mode === "easy") {
      const correct = columns[c].cells[r].correct;
      const pool = columns
        .flatMap((col) => col.cells.map((cell) => cell.correct))
        .filter((x) => x !== correct);
      const distractors = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
      setChoices([...distractors, correct].sort(() => Math.random() - 0.5));
    }
  }

  function judge(correct: boolean) {
    if (!open) return;
    const [c, r] = open;
    const cat = columns[c].cells[r].category;
    const st = stats.current[cat] ?? { correct: 0, total: 0 };
    stats.current[cat] = { correct: st.correct + (correct ? 1 : 0), total: st.total + 1 };
    setStates((s) => ({ ...s, [cellKey(c, r)]: correct ? "right" : "wrong" }));
    setScore((s) => s + (correct ? cellValue(r, c) : -cellValue(r, c)));
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
      <AchievementToast queue={toasts} />
      {/* Header */}
      {/* Host nameplate — the Secret Order character framing the board */}
      <div
        className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-3"
        style={{ borderColor: `${theme.accent}55` }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-2xl"
          style={{ borderColor: theme.accent, color: theme.accent }}
          aria-hidden
        >
          {theme.glyph}
        </div>
        <div className="leading-tight">
          <div className="display text-lg" style={{ color: theme.accent }}>
            {BOARD_HOST.name}
          </div>
          <div className="microlabel text-muted">
            {BOARD_HOST.title} · tonight: {theme.name}
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Codex</h1>
          {practiceMode && clues && clues.length > 0 && (
            <button
              onClick={newPracticeBoard}
              className="microlabel mt-2 rounded-full border border-wildcard px-4 py-1 text-wildcard transition hover:bg-wildcard hover:text-bg"
            >
              ↻ new board
            </button>
          )}
        </div>

        <div className="text-right">
          <div className="mb-2 flex items-center justify-end gap-1">
            <button
              onClick={() => setShowSettings((s) => !s)}
              aria-label="settings"
              aria-expanded={showSettings}
              className={`mr-1 rounded-full border px-3 py-1 text-base transition ${
                showSettings ? "border-gold text-gold" : "border-line text-muted hover:border-ink"
              }`}
            >
              ⚙
            </button>
            <button
              onClick={() => setMode("easy")}
              className={`microlabel rounded-full border px-3 py-1 transition ${
                mode === "easy"
                  ? "border-sports text-sports"
                  : "border-line text-muted hover:border-ink"
              }`}
            >
              easy
            </button>
            <button
              onClick={() => setMode("hard")}
              className={`microlabel rounded-full border px-3 py-1 transition ${
                mode === "hard"
                  ? "border-music text-music"
                  : "border-line text-muted hover:border-ink"
              }`}
            >
              hard
            </button>
          </div>
          <div className="microlabel">score</div>
          <div
            className={`tabular text-3xl font-black ${score < 0 ? "text-music" : "text-history"}`}
          >
            {score < 0 ? "−" : ""}${Math.abs(score).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Settings panel — persisted to localStorage, never to the DB */}
      {showSettings && (
        <div className="mb-5 rounded-xl border border-gold/40 bg-surface p-4">
          <div className="microlabel mb-3 text-gold">settings</div>
          <div className="flex flex-wrap gap-6">
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
          </div>
          {osReduced && (
            <p className="microlabel mt-3 text-muted">
              your system already requests reduced motion — honored.
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      {columns.length < 5 ? (
        <p className="text-muted">
          The bank is still warming up — not enough clue categories yet.
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {columns.map((col) => {
            const hex = CATEGORY_HEX[col.category];
            return (
              <div
                key={col.category}
                className="microlabel flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border bg-surface p-2 text-center"
                style={{
                  color: hex,
                  borderColor: `${theme.accent}55`,
                  background: `linear-gradient(160deg, ${hex}1a, transparent)`,
                }}
              >
                <span className="text-base opacity-70" style={{ color: theme.accent }} aria-hidden>
                  {theme.glyph}
                </span>
                <span>{themedLabel(theme, col.category, CATEGORY_LABEL[col.category])}</span>
              </div>
            );
          })}
          {[0, 1, 2, 3, 4].map((r) =>
            columns.map((col, c) => {
              const st = states[cellKey(c, r)];
              return (
                <div key={cellKey(c, r)} className="flip-scene min-h-14 sm:min-h-16">
                  <div className={`flip-inner h-full ${st ? "flipped" : ""}`}>
                    {/* front — the dollar value, click to open. The visible
                        label is just the value; the a11y name carries the
                        category + state so keyboard/SR users aren't navigating
                        25 identical "$200" tiles. */}
                    <button
                      disabled={Boolean(st)}
                      onClick={() => openCell(c, r)}
                      aria-label={`${themedLabel(theme, col.category, CATEGORY_LABEL[col.category])}, $${(r + 1) * 200}${st ? ` — answered ${st === "right" ? "correctly" : "incorrectly"}` : ""}`}
                      className="flip-face tabular absolute inset-0 flex items-center justify-center rounded-lg border border-line bg-surface text-lg font-black text-history transition hover:border-history hover:bg-history/10 sm:text-2xl"
                    >
                      ${(r + 1) * 200}
                    </button>
                    {/* back — the result, revealed by the card flip */}
                    <div
                      className={`flip-face flip-back tabular absolute inset-0 flex items-center justify-center rounded-lg border text-lg font-black sm:text-2xl ${
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
      )}

      {cleared && (
        <div className="mt-6 flex flex-col items-center text-center">
          <Confetti trigger={burst} />
          <p className="display text-2xl text-history">
            Board cleared — final ${score.toLocaleString()}
          </p>
          <LeaderboardPanel room="board" score={Math.max(0, score)} accent="history" />
        </div>
      )}

      {/* Question modal */}
      <AnimatePresence>
        {openQ && open && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-bg/90 p-4 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="board-q-prompt"
              tabIndex={-1}
              initial={reduced ? {} : { scale: 0.85, rotateY: 90 }}
              animate={{ scale: 1, rotateY: 0 }}
              transition={{ duration: 0.45 }}
              className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-8 outline-none"
              style={{ borderColor: CATEGORY_HEX[openQ.category] }}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className="microlabel"
                  style={{ color: CATEGORY_HEX[openQ.category] }}
                >
                  {themedLabel(theme, openQ.category, CATEGORY_LABEL[openQ.category])} · $
                  {cellValue(open[1], open[0])}
                </span>
                {isDD(open[0], open[1]) && (
                  <span className="microlabel animate-pulse text-history">
                    ★ daily double — stakes doubled
                  </span>
                )}
              </div>

              <p id="board-q-prompt" className={`display mt-6 leading-tight ${PROMPT_SIZE[settings.textSize]}`}>
                {openQ.prompt}
              </p>

              {/* Optional blur-reveal image clue (folded in from The Gallery).
                  Gated by the hint setting; sharpens on click or hover. */}
              {settings.hints && openQ.image_url && judgeResult === null && (
                <div className="mt-5 flex justify-center">
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
                      className="h-40 w-auto max-w-full object-contain transition-[filter] duration-500 sm:h-48"
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
                <div className="mt-8">
                  <p
                    className={`text-2xl font-black ${judgeResult ? "text-sports" : "text-music"}`}
                  >
                    {judgeResult ? "✓ Correct!" : "✗ Missed it"}
                  </p>
                  {!judgeResult && (
                    <p className="mt-1 text-muted">
                      The answer:{" "}
                      <span className="font-black text-ink">
                        What is {openQ.correct}?
                      </span>
                    </p>
                  )}
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
                      className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
                    >
                      continue
                    </button>
                    {practiceMode && (
                      <button
                        onClick={() =>
                          isSaved(openQ) ? removeQ(openQ.prompt) : saveQ(openQ)
                        }
                        className={`microlabel rounded-full border px-6 py-3 transition ${
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
                <div className={`mt-8 grid gap-3 sm:grid-cols-2 ${TEXT_SIZE_CLASS[settings.textSize]}`}>
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
                        className={`rounded-xl border p-4 text-left font-bold transition ${cls}`}
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
                <div className="mt-8">
                  <p className="microlabel mb-3 text-muted">
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
                      className="flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-ink outline-none focus:border-music"
                    />
                    <button
                      onClick={() => {
                        if (textAnswer.trim())
                          judge(liberalMatch(textAnswer, openQ.correct));
                      }}
                      disabled={!textAnswer.trim()}
                      className="microlabel rounded-full border border-music px-6 py-3 text-music transition enabled:hover:bg-music enabled:hover:text-bg disabled:opacity-30"
                    >
                      submit
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PracticeBar
        practiceMode={practiceMode}
        onToggle={togglePractice}
        saved={saved}
        onRemove={removeQ}
      />
    </div>
  );
}
