"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { BoardColumn } from "@/lib/queries";
import { CATEGORY_HEX, CATEGORY_LABEL } from "@/lib/types";

type CellState = "fresh" | "right" | "wrong";

export default function BoardGame({
  columns,
  dailyDouble,
}: {
  columns: BoardColumn[];
  dailyDouble: [number, number];
}) {
  const reduced = useReducedMotion();
  const [score, setScore] = useState(0);
  const [open, setOpen] = useState<[number, number] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [states, setStates] = useState<Record<string, CellState>>({});

  const key = (c: number, r: number) => `${c}:${r}`;
  const isDD = (c: number, r: number) => dailyDouble[0] === c && dailyDouble[1] === r;
  const value = (r: number, c: number) => (r + 1) * 200 * (isDD(c, r) ? 2 : 1);

  const played = Object.keys(states).length;
  const total = columns.length * 5;

  function judge(correct: boolean) {
    if (!open) return;
    const [c, r] = open;
    setStates((s) => ({ ...s, [key(c, r)]: correct ? "right" : "wrong" }));
    setScore((s) => s + (correct ? value(r, c) : -value(r, c)));
    setOpen(null);
    setRevealed(false);
  }

  const openQ = open ? columns[open[0]].cells[open[1]] : null;

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Board</h1>
        <div className="text-right">
          <div className="microlabel">score</div>
          <div className={`tabular text-3xl font-black ${score < 0 ? "text-music" : "text-history"}`}>
            {score < 0 ? "−" : ""}${Math.abs(score).toLocaleString()}
          </div>
        </div>
      </div>

      {columns.length < 5 ? (
        <p className="text-muted">The bank is still warming up — not enough clue categories yet.</p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {columns.map((col) => (
            <div
              key={col.category}
              className="microlabel flex min-h-12 items-center justify-center rounded-lg border border-line bg-surface p-2 text-center"
              style={{ color: CATEGORY_HEX[col.category] }}
            >
              {CATEGORY_LABEL[col.category]}
            </div>
          ))}
          {[0, 1, 2, 3, 4].map((r) =>
            columns.map((col, c) => {
              const st = states[key(c, r)];
              return (
                <button
                  key={key(c, r)}
                  disabled={Boolean(st)}
                  onClick={() => setOpen([c, r])}
                  className={`tabular flex min-h-14 items-center justify-center rounded-lg border text-lg font-black transition sm:min-h-16 sm:text-2xl ${
                    st
                      ? st === "right"
                        ? "border-sports/40 bg-surface text-sports/60"
                        : "border-music/40 bg-surface text-music/60"
                      : "border-line bg-surface text-history hover:border-history hover:bg-history/10"
                  }`}
                >
                  {st ? (st === "right" ? "✓" : "✗") : `$${(r + 1) * 200}`}
                </button>
              );
            }),
          )}
        </div>
      )}

      {played === total && total > 0 && (
        <p className="display mt-6 text-2xl text-history">
          Board cleared — final ${score.toLocaleString()}
        </p>
      )}

      <AnimatePresence>
        {openQ && open && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-bg/90 p-4 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={reduced ? {} : { scale: 0.85, rotateY: 90 }}
              animate={{ scale: 1, rotateY: 0 }}
              transition={{ duration: 0.45 }}
              className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-8"
              style={{ borderColor: CATEGORY_HEX[openQ.category] }}
            >
              <div className="flex items-baseline justify-between">
                <span className="microlabel" style={{ color: CATEGORY_HEX[openQ.category] }}>
                  {CATEGORY_LABEL[openQ.category]} · ${value(open[1], open[0])}
                </span>
                {isDD(open[0], open[1]) && (
                  <span className="microlabel animate-pulse text-history">★ daily double — stakes doubled</span>
                )}
              </div>
              <p className="display mt-6 text-2xl leading-tight sm:text-3xl">{openQ.prompt}</p>

              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
                >
                  reveal answer
                </button>
              ) : (
                <div className="mt-8">
                  <p className="microlabel">the answer</p>
                  <p className="mt-1 text-2xl font-black" style={{ color: CATEGORY_HEX[openQ.category] }}>
                    What is {openQ.correct}?
                  </p>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => judge(true)}
                      className="microlabel rounded-full border border-sports px-6 py-3 text-sports transition hover:bg-sports hover:text-bg"
                    >
                      ✓ I had it
                    </button>
                    <button
                      onClick={() => judge(false)}
                      className="microlabel rounded-full border border-music px-6 py-3 text-music transition hover:bg-music hover:text-bg"
                    >
                      ✗ missed it
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
