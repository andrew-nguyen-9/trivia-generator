"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { buildWeeklyCase, DIMS, type Dim } from "@/lib/weeklyCase";
import { buildShare, type GameResult, type Tier } from "@/lib/share";
import { CATEGORY_HEX } from "@/lib/types";
import styles from "./WeeklyCase.module.css";

const ACCENT = CATEGORY_HEX.history;

const DIM_LABEL: Record<Dim, string> = {
  suit: "Suit",
  era: "Era",
  haunt: "Haunt",
  tell: "Tell",
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// localStorage is the only store (v3 invariant: frontend never writes the DB).
// One record per weekly bucket so a solved week stays solved and the one
// accusation locks.
interface Progress {
  cleared: number[]; // suspect indices the player has struck out
  accusedIndex: number | null;
  accusedDay: number | null;
}

function loadProgress(weekSeed: number): Progress {
  if (typeof window === "undefined") return { cleared: [], accusedIndex: null, accusedDay: null };
  try {
    const raw = window.localStorage.getItem(`parlor:coldcase:${weekSeed}`);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    /* private mode / bad JSON — start fresh */
  }
  return { cleared: [], accusedIndex: null, accusedDay: null };
}

export default function WeeklyCaseGame({
  weekSeed,
  dayIndex,
}: {
  weekSeed: number;
  dayIndex: number;
}) {
  const c = useMemo(() => buildWeeklyCase(weekSeed), [weekSeed]);
  const currentDay = dayIndex + 1; // 1..7

  // Hydrate from storage after mount (SSR renders the empty board → no mismatch).
  const [prog, setProg] = useState<Progress>({ cleared: [], accusedIndex: null, accusedDay: null });
  useEffect(() => setProg(loadProgress(weekSeed)), [weekSeed]);

  const [pick, setPick] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const locked = prog.accusedIndex !== null;

  function persist(next: Progress) {
    setProg(next);
    try {
      window.localStorage.setItem(`parlor:coldcase:${weekSeed}`, JSON.stringify(next));
    } catch {
      /* storage unavailable — in-memory only */
    }
  }

  function toggleClear(i: number) {
    if (locked) return;
    const cleared = prog.cleared.includes(i)
      ? prog.cleared.filter((x) => x !== i)
      : [...prog.cleared, i];
    persist({ ...prog, cleared });
    if (pick === i) setPick(null);
  }

  function accuse() {
    if (locked || pick === null) return;
    persist({ ...prog, accusedIndex: pick, accusedDay: currentDay });
  }

  const correct = locked && prog.accusedIndex === c.culprit;

  // Share: seven squares, one per day. Days before the accusation = 🟨 (clues
  // you read), the accusation day = 🟩 if right / ⬛ if wrong, later days ⬜.
  const share = useMemo(() => {
    const accDay = prog.accusedDay ?? currentDay;
    const tiers: Tier[] = Array.from({ length: 7 }, (_, i) => {
      const day = i + 1;
      if (day < accDay) return "near";
      if (day === accDay) return locked ? (correct ? "hit" : "miss") : "blank";
      return "blank";
    });
    const card = buildShare({
      room: "/cold-case",
      date: `Week ${weekSeed}`,
      tiers,
    } satisfies GameResult);
    const headline = !locked
      ? "investigating…"
      : correct
        ? `cracked on day ${accDay}`
        : `case stays cold`;
    return {
      grid: card.grid,
      text: [`⚱ The Cold Case — ${headline}`, card.grid, card.url].join("\n"),
    };
  }, [prog.accusedDay, currentDay, locked, correct, weekSeed]);

  function copy() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        void navigator.share({ text: share.text }).catch(() => {});
      } else {
        void navigator.clipboard?.writeText(share.text);
      }
    } catch {
      /* clipboard/share unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const weekStartDay = weekSeed * 7; // days since epoch of day 1

  return (
    <div className={styles.root}>
      {/* Case header */}
      <div className={styles.head}>
        <div>
          <p className="microlabel" style={{ color: ACCENT }}>
            Day {currentDay} of 7 · the week-long case
          </p>
          <h1 className="display text-xl sm:text-2xl">Who took {c.relic}?</h1>
        </div>
        <p className="text-xs text-muted max-w-[16rem]">
          A clue from a different room each day. Cross them against the dossiers,
          then name the culprit. You get <strong>one</strong> accusation.
        </p>
      </div>

      <div className={styles.cols}>
        {/* Clue ledger */}
        <ol className={styles.ledger} aria-label="Daily clues">
          {c.clues.map((clue) => {
            const open = clue.day <= currentDay;
            const wd = WEEKDAY[((weekStartDay + clue.day - 1) % 7 + 7) % 7];
            return (
              <li key={clue.day} className={`${styles.clue} ${open ? "" : styles.locked}`}>
                <span className={styles.clueDay} style={open ? { color: ACCENT } : undefined}>
                  {open ? clue.room : `🔒 ${wd}`}
                </span>
                <span className={styles.clueText}>
                  {open ? clue.text : "Opens this day — return for the next clue."}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Suspect dossiers */}
        <div className={styles.board} role="list" aria-label="Suspects">
          {c.suspects.map((s, i) => {
            const isCleared = prog.cleared.includes(i);
            const isPick = pick === i;
            const isGuilty = locked && i === c.culprit;
            return (
              <button
                key={s.name}
                role="listitem"
                onClick={() => (locked ? undefined : setPick(isPick ? null : i))}
                className={[
                  styles.suspect,
                  isCleared ? styles.cleared : "",
                  isPick ? styles.picked : "",
                  isGuilty ? styles.guilty : "",
                ].join(" ")}
                style={isPick || isGuilty ? { borderColor: ACCENT } : undefined}
                disabled={locked}
              >
                <div className={styles.suspectTop}>
                  <span className={styles.glyph} aria-hidden>
                    {s.glyph}
                  </span>
                  <span className={styles.name}>{s.name}</span>
                  <span
                    className={styles.strike}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleClear(i);
                    }}
                    role="button"
                    aria-label={isCleared ? `Un-clear ${s.name}` : `Clear ${s.name}`}
                  >
                    {isCleared ? "↺" : "✕"}
                  </span>
                </div>
                <dl className={styles.attrs}>
                  {DIMS.map((dim) => (
                    <div key={dim} className={styles.attr}>
                      <dt>{DIM_LABEL[dim]}</dt>
                      <dd>{s.attrs[dim]}</dd>
                    </div>
                  ))}
                </dl>
                {isGuilty && <span className={styles.guiltyTag}>the culprit</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accusation / verdict */}
      {!locked ? (
        <div className={styles.actions}>
          <button
            onClick={accuse}
            disabled={pick === null}
            className={styles.accuse}
            style={pick !== null ? { background: ACCENT } : undefined}
          >
            {pick === null
              ? "Select a suspect to accuse"
              : `Name ${c.suspects[pick].name} — final answer`}
          </button>
          <p className="microlabel text-smoke">tap ✕ to strike a suspect · tap a card to select</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.verdict}
        >
          <p className="display text-2xl" style={{ color: correct ? ACCENT : "#b04a4a" }}>
            {correct ? "Case closed." : "The trail goes cold."}
          </p>
          <p className="text-sm text-muted">
            {correct
              ? `You named ${c.suspects[c.culprit].name} on day ${prog.accusedDay}.`
              : `It was ${c.suspects[c.culprit].name}. The case reopens next week.`}
          </p>
          <pre className={styles.grid}>{share.grid}</pre>
          <button onClick={copy} className={styles.accuse} style={{ background: ACCENT }}>
            {copied ? "copied ✓" : "share result"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
