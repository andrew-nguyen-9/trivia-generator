"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CATEGORY_HEX, type Question } from "@/lib/types";
import { playMelody, sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { shuffled } from "@/lib/rng";
import Confetti from "@/components/Confetti";
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";

const ROUNDS = 5;
const BPM = 132;

const melodyDuration = (q: Question) =>
  (q.melody ?? []).reduce((s, n) => s + n.d, 0) * (60 / BPM) * 1000;

export default function JukeboxGame({ pool }: { pool: Question[] }) {
  const { record } = useProfile();
  const [rounds, setRounds] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const [toasts, setToasts] = useState<Achievement[]>([]);

  const stopRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const start = useMemo(
    () => () => {
      setRounds(shuffled(pool, () => Math.random()).slice(0, ROUNDS));
      setI(0);
      setPicked(null);
      setCorrect(0);
      setDone(false);
    },
    [pool],
  );

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => () => stopPlayback(), []);

  function stopPlayback() {
    clearTimeout(timer.current);
    stopRef.current?.stop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  }

  const q = rounds[i];

  function play() {
    if (!q) return;
    stopPlayback();
    setPlaying(true);
    if (q.audio_url) {
      const el = new Audio(q.audio_url);
      el.volume = 0.8;
      audioRef.current = el;
      void el.play().catch(() => setPlaying(false));
      el.onended = () => setPlaying(false);
      timer.current = setTimeout(() => stopPlayback(), 12000); // cap preview
    } else if (q.melody?.length) {
      stopRef.current = playMelody(q.melody, BPM);
      timer.current = setTimeout(() => setPlaying(false), melodyDuration(q) + 100);
    } else {
      setPlaying(false);
    }
  }

  function choose(choice: string) {
    if (picked || !q) return;
    stopPlayback();
    setPicked(choice);
    if (choice === q.correct) {
      setCorrect((c) => c + 1);
      sfx.correct();
      haptic.correct();
    } else {
      sfx.wrong();
      haptic.wrong();
    }
  }

  function next() {
    if (i + 1 >= rounds.length) {
      finish();
      return;
    }
    setI(i + 1);
    setPicked(null);
  }

  function finish() {
    setDone(true);
    const finalCorrect = correct;
    if (finalCorrect >= Math.ceil(ROUNDS * 0.6)) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({
      room: "jukebox",
      score: finalCorrect,
      xp: finalCorrect * 120,
      correct: finalCorrect,
      total: ROUNDS,
      perCategory: { music: { correct: finalCorrect, total: ROUNDS } },
    });
    if (unlocked.length) setToasts(unlocked);
  }

  if (pool.length === 0) {
    return <p className="text-muted">The bank is still warming up — no tunes yet.</p>;
  }

  if (done) {
    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="microlabel">tunes named</p>
          <p className="display tabular text-8xl text-music">{correct}/{ROUNDS}</p>
          <LeaderboardPanel room="jukebox" score={correct} accent="music" />
          <button
            onClick={start}
            className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
          >
            another set
          </button>
        </div>
      </>
    );
  }

  const hex = CATEGORY_HEX[q?.category ?? "music"];

  return (
    <>
      <AchievementToast queue={toasts} />
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Jukebox</h1>
        <div className="text-right">
          <div className="microlabel">round {i + 1}/{ROUNDS} · named {correct}</div>
          <div className="tabular text-3xl font-black text-music">{correct}</div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center">
        {/* Equalizer */}
        <div className="flex h-28 items-end gap-1.5">
          {Array.from({ length: 13 }).map((_, k) => (
            <motion.span
              key={k}
              className="w-2.5 rounded-full"
              style={{ background: hex }}
              animate={
                playing
                  ? { height: [8, 18 + ((k * 13) % 80), 8] }
                  : { height: 8 }
              }
              transition={
                playing
                  ? { duration: 0.4 + (k % 5) * 0.08, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
              }
            />
          ))}
        </div>

        <button
          onClick={play}
          className="microlabel mt-8 rounded-full border px-10 py-4 text-lg transition"
          style={{ borderColor: hex, color: hex }}
        >
          {playing ? "♪ playing…" : picked ? "▶ replay" : "▶ play the clip"}
        </button>
        {q?.audio_url ? null : (
          <p className="microlabel mt-3 text-muted">synthesized melody · no spoilers in the title</p>
        )}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {(q?.choices ?? []).map((choice) => {
          const isCorrect = choice === q.correct;
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
              onClick={() => choose(choice)}
              disabled={Boolean(picked)}
              className={`rounded-xl border p-4 text-left font-bold transition ${cls}`}
            >
              {choice}
              {picked && isCorrect && " ✓"}
              {picked && isPicked && !isCorrect && " ✗"}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={next}
            className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
          >
            {i + 1 >= rounds.length ? "see score" : "next →"}
          </button>
          {q.source_url && (
            <a href={q.source_url} target="_blank" rel="noreferrer" className="microlabel underline">
              source
            </a>
          )}
        </div>
      )}
    </>
  );
}
