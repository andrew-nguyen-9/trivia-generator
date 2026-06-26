"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CATEGORY_HEX, type Question } from "@/lib/types";
import { playMelody, sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { mulberry32, pickRotating, shuffled } from "@/lib/rng";
import { buildShare, type GameResult, type Tier } from "@/lib/share";
import { buildChoices, titledRows, type TitledRow } from "@/lib/overture";
import dynamic from "next/dynamic";
// code-split: the win-only canvas confetti is fetched on demand (perf 2.16).
const Confetti = dynamic(() => import("@/components/Confetti"), { ssr: false });
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import styles from "./AudioRoom.module.css";

const BPM = 120;
const HEX = CATEGORY_HEX.music;
const TICK = 100; // ms — countdown granularity

// Two ways to play the same engine. `set` is the casual replayable run (5 tunes,
// speed-tiered); `daily` is the shared Heardle-style single intro (one day-seeded
// track, the melody revealed a little more on every wrong guess).
type Mode = "set" | "daily";
interface ModeCfg {
  rounds: number;
  tries: number; // guesses allowed before the round fails
  choices: number; // options shown
  reveal: boolean; // daily: start with a sliver of the intro, reveal more on miss
  roundMs: number; // hard-timeout per round → fail
  max: number; // share-card max score
}
const CFG: Record<Mode, ModeCfg> = {
  set: { rounds: 5, tries: 2, choices: 4, reveal: false, roundMs: 12000, max: 500 },
  daily: { rounds: 1, tries: 6, choices: 6, reveal: true, roundMs: 45000, max: 100 },
};

interface Round {
  q: Question;
  title: string;
  choices: string[];
}

const tierFromPts = (pts: number): Tier => (pts >= 80 ? "hit" : pts > 0 ? "near" : "miss");

export default function AudioRoomGame({
  pool,
  daySeed,
}: {
  pool: Question[];
  daySeed: number;
}) {
  const { record } = useProfile();
  const titled = useMemo(() => titledRows(pool), [pool]);

  const [mode, setMode] = useState<Mode>("set");
  const cfg = CFG[mode];

  const [rounds, setRounds] = useState<Round[]>([]);
  const [i, setI] = useState(0);
  const [attempts, setAttempts] = useState(0); // wrong guesses this round
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [roundPts, setRoundPts] = useState(0);
  const [reveal, setReveal] = useState(1); // how much of the intro is unlocked (1..tries)
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticking, setTicking] = useState(false); // hard-timeout clock runs after first play
  const [playing, setPlaying] = useState(false);

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [points, setPoints] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [copied, setCopied] = useState(false);

  const stopRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdown = useRef<ReturnType<typeof setInterval>>();
  const recorded = useRef(false);

  const q = rounds[i];

  const stopPlayback = useCallback(() => {
    clearTimeout(playTimer.current);
    stopRef.current?.stop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  }, []);

  const clearTimers = useCallback(() => {
    clearInterval(countdown.current);
    stopPlayback();
  }, [stopPlayback]);

  // Build a fresh run for the active mode. `set` shuffles freely (replayable, not
  // shared); `daily` is day-seeded so every player gets the same intro + options.
  const start = useCallback(() => {
    const make = (rows: TitledRow[], rand: () => number): Round[] =>
      rows.map((r) => ({
        q: r.q,
        title: r.title,
        choices: buildChoices(r.title, titled.map((t) => t.title), rand, cfg.choices),
      }));

    let next: Round[];
    if (mode === "daily") {
      const rand = mulberry32(daySeed * 2654435761);
      const pick = pickRotating(titled, 1, daySeed);
      next = make(pick, rand);
    } else {
      const rand = () => Math.random();
      next = make(shuffled(titled, rand).slice(0, cfg.rounds), rand);
    }
    setRounds(next);
    setI(0);
    setTiers([]);
    setPoints(0);
    setCorrect(0);
    setDone(false);
    setCopied(false);
    recorded.current = false;
  }, [mode, daySeed, titled, cfg.rounds, cfg.choices]);

  useEffect(() => {
    start();
  }, [start]);

  // Per-round reset. The hard-timeout clock does NOT start here — it starts on
  // the first play (startClock), so reading the choices never burns the timer.
  useEffect(() => {
    if (!q || done) return;
    setAttempts(0);
    setEliminated([]);
    setSolved(false);
    setFailed(false);
    setRoundPts(0);
    setReveal(1);
    setTimeLeft(cfg.roundMs);
    setTicking(false);
    clearInterval(countdown.current);
    stopPlayback();
  }, [i, rounds, done, cfg.roundMs, stopPlayback]);

  // Hard-timeout countdown — armed by the first play of the round. Reaching zero
  // fails the round.
  const startClock = useCallback(() => {
    clearInterval(countdown.current);
    setTicking(true);
    countdown.current = setInterval(() => {
      setTimeLeft((t) => {
        const nt = t - TICK;
        if (nt <= 0) {
          clearInterval(countdown.current);
          failRound();
          return 0;
        }
        return nt;
      });
    }, TICK);
    // failRound uses functional setState, so the closure stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // How much of the intro to sound: daily reveals a growing slice, set plays it all.
  function play() {
    if (!q || solved || failed) return;
    if (!ticking) startClock(); // the round clock drops with the needle
    stopPlayback();
    setPlaying(true);
    if (q.q.audio_url) {
      const el = new Audio(q.q.audio_url);
      el.volume = 0.8;
      audioRef.current = el;
      void el.play().catch(() => setPlaying(false));
      el.onended = () => setPlaying(false);
      const secs = cfg.reveal ? Math.min(12, 2 * reveal) : 12;
      playTimer.current = setTimeout(() => stopPlayback(), secs * 1000);
    } else if (q.q.melody?.length) {
      const total = q.q.melody.length;
      const n = cfg.reveal ? Math.max(2, Math.ceil((total * reveal) / cfg.tries)) : total;
      const slice = q.q.melody.slice(0, n);
      stopRef.current = playMelody(slice, BPM);
      const ms = slice.reduce((s, note) => s + note.d, 0) * (60 / BPM) * 1000;
      playTimer.current = setTimeout(() => setPlaying(false), ms + 100);
    } else {
      setPlaying(false);
    }
  }

  function failRound() {
    setFailed(true);
    setRoundPts(0);
    setTiers((t) => [...t, "miss"]);
    clearTimers();
    sfx.lose();
    haptic.wrong();
  }

  function choose(choice: string) {
    if (!q || solved || failed) return;
    if (choice === q.title) {
      clearTimers();
      const frac = Math.max(0, timeLeft / cfg.roundMs);
      const pts = cfg.reveal
        ? Math.max(20, 100 - attempts * 18) // daily: fewer tries → more points
        : Math.max(40, Math.round(40 + 60 * frac)) - (attempts > 0 ? 25 : 0); // set: speed, 2nd-try penalty
      setSolved(true);
      setRoundPts(pts);
      setPoints((p) => p + pts);
      setCorrect((c) => c + 1);
      setTiers((t) => [...t, tierFromPts(pts)]);
      sfx.correct();
      haptic.correct();
    } else {
      const used = attempts + 1;
      setAttempts(used);
      setEliminated((e) => [...e, choice]);
      sfx.wrong();
      haptic.wrong();
      if (used >= cfg.tries) {
        failRound();
      } else if (cfg.reveal) {
        setReveal((r) => Math.min(cfg.tries, r + 1)); // unlock more of the intro
      }
    }
  }

  function next() {
    if (i + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
  }

  // Finish: SFX + persist. The Overture absorbs the retired Jukebox, so it records
  // under the "jukebox" profile key (keeps the 🎧 Perfect Ear badge + leaderboard
  // scale, and feeds §3.19 music weak-spot). profile.ts is shared — not ours to edit.
  useEffect(() => {
    if (!done || recorded.current) return;
    recorded.current = true;
    const win = correct >= Math.ceil(rounds.length * 0.6);
    if (win) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({
      room: "jukebox",
      score: correct, // "tunes named" — preserves the badge's 5/5 meaning
      xp: points, // speed/skill points fuel XP + levels
      correct,
      total: rounds.length,
      perCategory: { music: { correct, total: rounds.length } },
    });
    if (unlocked.length) setToasts(unlocked);
  }, [done, correct, points, rounds.length, record]);

  if (titled.length === 0) {
    return <p className="text-muted">The bank is still warming up — no intros yet.</p>;
  }

  if (done) {
    // ponytail: client Date() for the share label only — the daily intro is
    // day-seeded server-side, so deriving the cosmetic date on this click is safe.
    const result: GameResult = {
      room: "/overture",
      date: new Date().toISOString().slice(0, 10),
      tiers,
      score: points,
      maxScore: cfg.max,
      columns: mode === "set" ? 5 : 1,
    };
    const card = buildShare(result);
    const share = () => {
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          void navigator.share({ text: card.text, url: card.url }).catch(() => {});
        } else {
          void navigator.clipboard?.writeText(card.text);
        }
      } catch {
        /* clipboard/share unavailable — no-op */
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="microlabel">score</p>
          <p className="display tabular text-8xl text-music">{points}</p>
          <p className="mt-2 text-muted">
            {correct}/{rounds.length} named{mode === "daily" ? " · the daily intro" : ""}
          </p>

          <p className="microlabel mt-6 text-muted">your overture</p>
          <div className={`mt-1 ${styles.line}`} aria-label="per-round result">
            {card.grid}
          </div>

          <LeaderboardPanel room="jukebox" score={correct} accent="music" />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={share}
              className="microlabel rounded-full border border-music px-6 py-3 text-music transition hover:bg-music hover:text-bg"
            >
              {copied ? "copied ✓" : "share result"}
            </button>
            <button
              onClick={start}
              className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
            >
              {mode === "daily" ? "replay the intro" : "another set"}
            </button>
          </div>
        </div>
      </>
    );
  }

  // rounds are built client-side (start() in an effect), so q is undefined during
  // SSR and on the first paint — render nothing until it populates.
  if (!q) return null;

  const timeFrac = Math.max(0, timeLeft / cfg.roundMs);
  const locked = solved || failed;

  return (
    <>
      <Confetti trigger={burst} />
      <AchievementToast queue={toasts} />

      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Overture</h1>
        <div className="text-right">
          <div className="microlabel">
            {mode === "set" ? `round ${i + 1}/${rounds.length} · ` : "daily intro · "}score
          </div>
          <div className="tabular text-3xl font-black text-music">{points}</div>
        </div>
      </div>

      {/* Mode toggle — switching rebuilds the run for that mode. */}
      <div className="mt-4 flex gap-2">
        {(["set", "daily"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`microlabel rounded-full border px-4 py-2 transition ${
              mode === m ? "border-music bg-music/15 text-music" : "border-line text-muted hover:border-ink"
            }`}
          >
            {m === "set" ? "set of 5" : "daily intro"}
          </button>
        ))}
      </div>

      <div className={`mt-6 ${styles.play}`}>
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-7">
          <span className="microlabel" style={{ color: HEX }}>
            name the intro{cfg.reveal ? " · the needle drops slowly" : ""}
          </span>

          {/* Equalizer — animates while the clip/melody sounds. */}
          <div className={`mt-5 flex items-end justify-center gap-1.5 ${styles.eq}`}>
            {Array.from({ length: 13 }).map((_, k) => (
              <motion.span
                key={k}
                className="w-2.5 rounded-full"
                style={{ background: HEX }}
                animate={playing ? { height: [8, 18 + ((k * 13) % 80), 8] } : { height: 8 }}
                transition={
                  playing
                    ? { duration: 0.4 + (k % 5) * 0.08, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.2 }
                }
              />
            ))}
          </div>

          <div className="mt-5 flex flex-col items-center">
            <button
              onClick={play}
              disabled={locked}
              className="microlabel rounded-full border px-10 py-4 text-lg transition disabled:opacity-40"
              style={{ borderColor: HEX, color: HEX }}
            >
              {playing ? "♪ playing…" : locked ? "—" : "▶ play the intro"}
            </button>

            {cfg.reveal && !locked && (
              <p className="microlabel mt-3 text-muted" aria-label="intro revealed">
                intro revealed{"  "}
                {Array.from({ length: cfg.tries }).map((_, k) => (k < reveal ? "▮" : "▯")).join("")}
              </p>
            )}
            {!q.q.audio_url && !cfg.reveal && (
              <p className="microlabel mt-3 text-muted">synthesized — no spoilers in the title</p>
            )}
          </div>
        </div>

        {/* Right column: hard-timeout meter + the choices. */}
        <div className="flex flex-col">
          <div className={styles.meter} aria-hidden>
            <motion.div
              className={styles.meterFill}
              style={{ background: HEX }}
              animate={{ width: `${(locked ? 0 : timeFrac) * 100}%` }}
              transition={{ duration: 0.1, ease: "linear" }}
            />
          </div>
          <p className="microlabel mt-1 text-muted">
            {locked
              ? solved
                ? `+${roundPts} pts`
                : "out of time"
              : ticking
                ? `${(timeLeft / 1000).toFixed(1)}s · try ${attempts + 1}/${cfg.tries}`
                : `play to start · try ${attempts + 1}/${cfg.tries}`}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {q.choices.map((choice) => {
              const isCorrect = choice === q.title;
              const isOut = eliminated.includes(choice);
              const cls = locked
                ? isCorrect
                  ? "border-sports bg-sports/15 text-sports"
                  : "border-line text-muted"
                : isOut
                  ? "border-line text-muted line-through opacity-50"
                  : "border-line hover:border-ink";
              return (
                <button
                  key={choice}
                  onClick={() => choose(choice)}
                  disabled={locked || isOut}
                  className={`rounded-xl border p-4 text-left font-bold transition ${cls}`}
                >
                  {choice}
                  {locked && isCorrect && " ✓"}
                  {isOut && " ✗"}
                </button>
              );
            })}
          </div>

          {locked && (
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={next}
                className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
              >
                {i + 1 >= rounds.length ? "see score" : "next →"}
              </button>
              {q.q.source_url && (
                <a
                  href={q.q.source_url}
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
      </div>
    </>
  );
}
