"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CATEGORY_HEX, CATEGORY_LABEL, type Question } from "@/lib/types";
import { usePractice } from "@/lib/usePractice";
import PracticeBar from "@/components/PracticeBar";
import { mulberry32, shuffled } from "@/lib/rng";
import { playMelody, sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import dynamic from "next/dynamic";
// code-split: the win-only canvas confetti is fetched on demand, not in
// the room's initial bundle (perf 2.16).
const Confetti = dynamic(() => import("@/components/Confetti"), { ssr: false });
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import { buildPuzzle, type ClockPuzzle } from "@/lib/clockLogic";
import { CLOCKKEEPER, labelFor, type CalendarSystem } from "@/lib/calendars";

const MIN_YEAR = 1800;
const MAX_YEAR = new Date().getFullYear();
const HINT_CAP = 80; // max points when the calendar-conversion hint is used

const pointsFor = (guess: number, truth: number, hintUsed: boolean) =>
  Math.min(
    hintUsed ? HINT_CAP : 100,
    Math.max(0, 100 - 2 * Math.abs(guess - truth)),
  );

const BPM = 132;
const melodyMs = (q: Question) =>
  (q.melody ?? []).reduce((s, n) => s + n.d, 0) * (60 / BPM) * 1000;

export default function ClockGame({
  rounds: initialRounds,
  pool,
  calendar,
  daySeed: seed,
}: {
  rounds: Question[];
  pool?: Question[];
  calendar: CalendarSystem;
  daySeed: number;
}) {
  const reduced = useReducedMotion();
  const { practiceMode, togglePractice, saved, saveQ, removeQ, isSaved } = usePractice();
  const { record } = useProfile();

  const [rounds] = useState(initialRounds);
  const [i, setI] = useState(0);
  const [locked, setLocked] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [playing, setPlaying] = useState(false);
  const recorded = useRef(false);

  const stopRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout>>();

  const q = rounds[i];
  const truth = q ? q.year ?? Number(q.correct) : 0;
  const isAudio = Boolean(q && (q.audio_url || q.melody?.length));

  // Per-round logic puzzle: clues bound the year to a deducible window. Derived
  // lazily from the target year + a per-round seed (SSR/client agree).
  const puzzle: ClockPuzzle = useMemo(
    () =>
      q
        ? buildPuzzle(truth, MAX_YEAR, (seed * 131 + i * 17) >>> 0)
        : { clues: [], min: MIN_YEAR, max: MAX_YEAR },
    [q, truth, seed, i],
  );

  // The hands start at the centre of the deduced window, not a fixed year, so
  // the constraint frames the guess. Reset when the round (window) changes.
  const [guess, setGuess] = useState(0);
  useEffect(() => {
    setGuess(Math.round((puzzle.min + puzzle.max) / 2));
  }, [puzzle.min, puzzle.max]);

  useEffect(() => () => stopPlayback(), []);

  function stopPlayback() {
    clearTimeout(playTimer.current);
    stopRef.current?.stop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  }

  function playClip() {
    if (!q) return;
    stopPlayback();
    setPlaying(true);
    if (q.audio_url) {
      const el = new Audio(q.audio_url);
      el.volume = 0.8;
      audioRef.current = el;
      void el.play().catch(() => setPlaying(false));
      el.onended = () => setPlaying(false);
      playTimer.current = setTimeout(() => stopPlayback(), 12000);
    } else if (q.melody?.length) {
      stopRef.current = playMelody(q.melody, BPM);
      playTimer.current = setTimeout(() => setPlaying(false), melodyMs(q) + 100);
    } else {
      setPlaying(false);
    }
  }

  useEffect(() => {
    if (!done || recorded.current) return;
    recorded.current = true;
    const win = score >= rounds.length * 60;
    if (win) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({ room: "clock", score, xp: score });
    if (unlocked.length) setToasts(unlocked);
  }, [done, score, rounds.length, record]);

  if (rounds.length === 0) {
    return (
      <p className="text-muted">The bank is still warming up — no dated facts yet.</p>
    );
  }

  const pts = pointsFor(guess, truth, hintUsed);
  // Hand angle: map the deduced window onto a 12-hour sweep (−150°..+150°),
  // so the constraint — not the whole century — drives the dial.
  const span = Math.max(1, puzzle.max - puzzle.min);
  const frac = Math.min(1, Math.max(0, (guess - puzzle.min) / span));
  const truthFrac = Math.min(1, Math.max(0, (truth - puzzle.min) / span));
  const minuteAngle = -150 + frac * 300;
  const hourAngle = -150 + frac * 300 * 0.5;
  const truthAngle = -150 + truthFrac * 300;

  function showHint() {
    setHintUsed(true);
  }

  function lock() {
    stopPlayback();
    setLocked(true);
    setScore((s) => s + pts);
    if (pts >= 80) {
      sfx.correct();
      haptic.correct();
    } else if (pts >= 40) {
      sfx.select();
    } else {
      sfx.wrong();
    }
  }

  function next() {
    if (i + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    stopPlayback();
    setI(i + 1);
    setLocked(false);
    setHintUsed(false);
  }

  function restart() {
    setI(0);
    setLocked(false);
    setHintUsed(false);
    setScore(0);
    setDone(false);
    recorded.current = false;
  }

  if (done) {
    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="microlabel">final score</p>
          <p className="display tabular text-8xl text-music">{score}</p>
          <p className="mt-2 text-muted">out of {rounds.length * 100}</p>
          <LeaderboardPanel room="clock" score={score} accent="music" />
          <div className="mt-8 flex gap-3">
            <button
              onClick={restart}
              className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
            >
              rewind the clock
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

  const dialHex = calendar.accent;

  return (
    <div>
      <Confetti trigger={burst} />
      <AchievementToast queue={toasts} />
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">Chronos</h1>
        <div className="text-right">
          <div className="microlabel">
            round {i + 1}/{rounds.length} · score
          </div>
          <div className="tabular text-3xl font-black text-music">{score}</div>
        </div>
      </div>

      {/* Clockkeeper nameplate + calendar of the day */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 place-items-center rounded-full border text-lg"
            style={{ borderColor: `${dialHex}88`, color: dialHex }}
            aria-hidden
          >
            {calendar.glyph}
          </span>
          <div>
            <div className="microlabel" style={{ color: dialHex }}>
              {CLOCKKEEPER.name}
            </div>
            <div className="text-xs text-muted">{CLOCKKEEPER.title}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="microlabel" style={{ color: dialHex }}>
            {calendar.name}
          </div>
          <div className="text-xs text-muted">{calendar.blurb}</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <span className="microlabel" style={{ color: CATEGORY_HEX[q.category] }}>
          {CATEGORY_LABEL[q.category]}
          {isAudio && " · audio round"}
        </span>
        {isAudio ? (
          <div className="mt-3">
            <p className="display text-2xl leading-tight sm:text-3xl">
              Hear the clip — when was it released?
            </p>
            <button
              onClick={playClip}
              className="microlabel mt-4 rounded-full border px-8 py-3 transition"
              style={{ borderColor: CATEGORY_HEX[q.category], color: CATEGORY_HEX[q.category] }}
            >
              {playing ? "♪ playing…" : "▶ play the clip"}
            </button>
            {!q.audio_url && (
              <p className="microlabel mt-2 text-muted">synthesized — no spoilers</p>
            )}
          </div>
        ) : (
          <p className="display mt-3 text-2xl leading-tight sm:text-3xl">{q.prompt}</p>
        )}

        {/* Logic-puzzle layer: clues that constrain the date range */}
        <div className="mt-5">
          <p className="microlabel text-muted">the clockkeeper's clues</p>
          <ul className="mt-2 space-y-1">
            {puzzle.clues.map((c, k) => (
              <li key={k} className="flex items-start gap-2 text-sm">
                <span style={{ color: dialHex }} aria-hidden>
                  ◷
                </span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          <p className="microlabel mt-2 text-muted">
            deduced window: {puzzle.min}–{puzzle.max}
          </p>
        </div>

        {/* Calendar conversion hint */}
        {hintUsed && !locked && calendar.key !== "gregorian" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2"
            style={{ borderColor: `${dialHex}66`, background: `${dialHex}1a` }}
          >
            <span style={{ color: dialHex }}>⌛</span>
            <span className="microlabel" style={{ color: dialHex }}>
              In {calendar.name}, the answer reads {labelFor(calendar.key, truth)}
            </span>
            <span className="microlabel ml-auto text-muted">max {HINT_CAP} pts</span>
          </motion.div>
        )}
      </div>

      {/* Grandfather clock: ornate face, pendulum, hands = the year selector */}
      <div className="mt-8 flex flex-col items-center">
        <ClockFace
          hourAngle={hourAngle}
          minuteAngle={minuteAngle}
          truthAngle={locked ? truthAngle : null}
          accent={dialHex}
          reduced={Boolean(reduced)}
        />

        <div className="mt-4 text-center">
          <div className="microlabel">{locked ? "the truth" : "your guess"}</div>
          <motion.div
            key={locked ? "truth" : guess}
            initial={reduced || !locked ? {} : { scale: 1.2 }}
            animate={{ scale: 1 }}
            className="display tabular text-[clamp(3rem,12vw,6.5rem)]"
            style={{ color: locked ? CATEGORY_HEX[q.category] : undefined }}
          >
            {locked ? truth : guess}
          </motion.div>
          {calendar.key !== "gregorian" && (
            <div className="microlabel" style={{ color: dialHex }}>
              {calendar.name}: {labelFor(calendar.key, locked ? truth : guess)}
            </div>
          )}
        </div>

        {!locked ? (
          <div className="mt-4 w-full max-w-md">
            <input
              type="range"
              min={puzzle.min}
              max={puzzle.max}
              value={guess}
              onChange={(e) => setGuess(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: dialHex }}
              aria-label="turn the clock hands to a year"
            />
            <div className="microlabel mt-1 flex justify-between">
              <span>{puzzle.min}</span>
              <span>{puzzle.max}</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {!hintUsed && calendar.key !== "gregorian" && (
                <button
                  onClick={showHint}
                  className="microlabel rounded-full border px-6 py-3 transition"
                  style={{ borderColor: dialHex, color: dialHex }}
                >
                  ⌛ read the {calendar.name} (−20 max pts)
                </button>
              )}
              <button
                onClick={lock}
                className="microlabel rounded-full border border-music px-8 py-3 text-music transition hover:bg-music hover:text-bg"
              >
                lock it in
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-center">
            <p className="text-muted">
              you said{" "}
              <span className="tabular font-black text-ink">{guess}</span> — off by{" "}
              <span className="tabular font-black text-ink">
                {Math.abs(guess - truth)}
              </span>{" "}
              {Math.abs(guess - truth) === 1 ? "year" : "years"}
              {hintUsed && (
                <span style={{ color: dialHex }}> (hint used, capped at {HINT_CAP})</span>
              )}
            </p>
            <p className="mt-2 text-2xl font-black text-music">+{pts} pts</p>
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
            {practiceMode && (
              <div className="mt-3">
                <button
                  onClick={() => (isSaved(q) ? removeQ(q.prompt) : saveQ(q))}
                  className={`microlabel rounded-full border px-4 py-2 transition ${
                    isSaved(q)
                      ? "border-history text-history"
                      : "border-line text-muted hover:border-history hover:text-history"
                  }`}
                >
                  {isSaved(q) ? "★ saved" : "☆ save question"}
                </button>
              </div>
            )}
            <div>
              <button
                onClick={next}
                className="microlabel mt-6 rounded-full border border-ink px-8 py-3 transition hover:bg-ink hover:text-bg"
              >
                {i + 1 >= rounds.length ? "finish" : "next →"}
              </button>
            </div>
          </div>
        )}
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

/** Ornate grandfather-clock face. Hands rotate to the guess; pendulum swings via
 *  CSS (frozen under reduced-motion). The minute hand IS the year selector. */
function ClockFace({
  hourAngle,
  minuteAngle,
  truthAngle,
  accent,
  reduced,
}: {
  hourAngle: number;
  minuteAngle: number;
  truthAngle: number | null;
  accent: string;
  reduced: boolean;
}) {
  const ticks = Array.from({ length: 60 });
  return (
    <div className="relative" style={{ width: "min(78vw, 320px)" }}>
      <svg viewBox="0 0 200 270" className="w-full" role="img" aria-label="grandfather clock">
        {/* case */}
        <rect x="18" y="4" width="164" height="262" rx="14"
          fill="#1b140f" stroke={`${accent}55`} strokeWidth="2" />
        <rect x="30" y="14" width="140" height="142" rx="10"
          fill="#0f0b08" stroke={`${accent}88`} strokeWidth="1.5" />
        {/* dial */}
        <circle cx="100" cy="85" r="62" fill="#14100c" stroke={accent} strokeWidth="2.5" />
        <circle cx="100" cy="85" r="62" fill="none"
          stroke={`${accent}33`} strokeWidth="8" />
        {/* minute ticks */}
        {ticks.map((_, k) => {
          const a = (k * 6 * Math.PI) / 180;
          const r1 = k % 5 === 0 ? 50 : 55;
          const r2 = 60;
          return (
            <line
              key={k}
              x1={100 + r1 * Math.sin(a)}
              y1={85 - r1 * Math.cos(a)}
              x2={100 + r2 * Math.sin(a)}
              y2={85 - r2 * Math.cos(a)}
              stroke={k % 5 === 0 ? accent : `${accent}66`}
              strokeWidth={k % 5 === 0 ? 1.6 : 0.8}
            />
          );
        })}
        {/* truth marker (after lock) */}
        {truthAngle !== null && (
          <line
            x1="100" y1="85"
            x2={100 + 50 * Math.sin((truthAngle * Math.PI) / 180)}
            y2={85 - 50 * Math.cos((truthAngle * Math.PI) / 180)}
            stroke="#2d9155" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="3 3"
          />
        )}
        {/* hour hand */}
        <line
          x1="100" y1="85"
          x2={100 + 30 * Math.sin((hourAngle * Math.PI) / 180)}
          y2={85 - 30 * Math.cos((hourAngle * Math.PI) / 180)}
          stroke="#e7dcc8" strokeWidth="4" strokeLinecap="round"
        />
        {/* minute hand = the selector */}
        <line
          x1="100" y1="85"
          x2={100 + 48 * Math.sin((minuteAngle * Math.PI) / 180)}
          y2={85 - 48 * Math.cos((minuteAngle * Math.PI) / 180)}
          stroke={accent} strokeWidth="2.5" strokeLinecap="round"
        />
        <circle cx="100" cy="85" r="4" fill={accent} />

        {/* pendulum window */}
        <rect x="46" y="164" width="108" height="96" rx="8"
          fill="#0f0b08" stroke={`${accent}66`} strokeWidth="1" />
        <g
          className={reduced ? undefined : "clock-pendulum"}
          style={{ transformOrigin: "100px 168px" }}
        >
          <line x1="100" y1="168" x2="100" y2="234" stroke={accent} strokeWidth="1.5" />
          <circle cx="100" cy="240" r="11" fill={accent} stroke="#1b140f" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}
