"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import WorldMap from "@/components/WorldMap";
import { haversineKm, mapPoints, type LatLng } from "@/lib/geo";
import { CATEGORY_HEX, CATEGORY_LABEL, type Question } from "@/lib/types";

// One round from each room, 100 pts each. Result persists per day and turns
// into a shareable emoji line (the Wordle mechanic, see docs/GAME_MODES.md).

const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear();

const emoji = (pts: number) => (pts >= 80 ? "🟩" : pts >= 40 ? "🟨" : "🟥");

interface SavedResult {
  scores: number[];
  total: number;
}

export default function DailyGame({
  rounds,
  dailyNumber,
}: {
  rounds: Question[];
  dailyNumber: number;
}) {
  const storageKey = `parlor:daily:${dailyNumber}`;
  const [i, setI] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [phase, setPhase] = useState<"play" | "reveal" | "done">("play");
  const [saved, setSaved] = useState<SavedResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // round-local input state
  const [picked, setPicked] = useState<string | null>(null);
  const [year, setYear] = useState(1970);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [lastPts, setLastPts] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) setSaved(JSON.parse(raw));
    setLoaded(true);
  }, [storageKey]);

  const q = rounds[i];
  // MC options come pre-shuffled deterministically? choices order is as stored;
  // daily must be identical for everyone, so we keep stored order.
  const choices = useMemo(() => q?.choices ?? [], [q]);

  if (!loaded) return null;
  if (rounds.length < 5) {
    return <p className="text-muted">The bank is still warming up — the daily needs all five rooms stocked.</p>;
  }

  const total = scores.reduce((a, b) => a + b, 0);

  function finishRound(pts: number) {
    setLastPts(pts);
    setScores((s) => [...s, pts]);
    setPhase("reveal");
  }

  function nextRound() {
    if (i + 1 >= rounds.length) {
      const result = { scores, total };
      localStorage.setItem(storageKey, JSON.stringify(result));
      setSaved(result);
      setPhase("done");
      return;
    }
    setI(i + 1);
    setPicked(null);
    setYear(1970);
    setPin(null);
    setPhase("play");
  }

  async function share(result: SavedResult) {
    const line = `PARLOR DAILY #${dailyNumber} — ${result.total}/500\n${result.scores
      .map(emoji)
      .join("")}\n`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the text is on screen anyway */
    }
  }

  if (saved && phase !== "done") {
    // already played today
    return <Results dailyNumber={dailyNumber} result={saved} onShare={share} copied={copied} />;
  }
  if (phase === "done" && saved) {
    return <Results dailyNumber={dailyNumber} result={saved} onShare={share} copied={copied} />;
  }

  const hex = CATEGORY_HEX[q.category];
  const truth: LatLng | null = q.qtype === "where" ? { lat: q.lat!, lng: q.lng! } : null;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Daily</h1>
        <div className="text-right">
          <div className="microlabel">
            #{dailyNumber} · round {i + 1}/5
          </div>
          <div className="tabular text-3xl font-black text-wildcard">{total}</div>
        </div>
      </div>

      <div className="mt-1 flex gap-1">
        {rounds.map((_, k) => (
          <span key={k} className="text-sm">
            {k < scores.length ? emoji(scores[k]) : "⬛"}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-6">
        <span className="microlabel" style={{ color: hex }}>
          {CATEGORY_LABEL[q.category]} · {q.qtype.replace("_", " ")}
        </span>
        <p className="display mt-2 text-xl leading-tight sm:text-2xl">{q.prompt}</p>

        {/* ── multiple choice ── */}
        {q.qtype === "multiple_choice" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {choices.map((c) => {
              const cls =
                phase === "reveal"
                  ? c === q.correct
                    ? "border-sports bg-sports/15 text-sports"
                    : c === picked
                      ? "border-music bg-music/15 text-music"
                      : "border-line text-muted"
                  : "border-line hover:border-ink";
              return (
                <button
                  key={c}
                  disabled={phase === "reveal"}
                  onClick={() => {
                    setPicked(c);
                    finishRound(c === q.correct ? 100 : 0);
                  }}
                  className={`rounded-xl border p-4 text-left font-bold transition ${cls}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}

        {/* ── year guess ── */}
        {q.qtype === "year_guess" && (
          <div className="mt-5 text-center">
            <div className="display tabular text-6xl" style={{ color: phase === "reveal" ? hex : undefined }}>
              {phase === "reveal" ? q.year : year}
            </div>
            {phase === "play" && (
              <>
                <input
                  type="range"
                  min={MIN_YEAR}
                  max={MAX_YEAR}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-4 w-full accent-[#b07aff]"
                  aria-label="year guess"
                />
                <button
                  onClick={() => finishRound(Math.max(0, 100 - 2 * Math.abs(year - (q.year ?? 0))))}
                  className="microlabel mt-4 rounded-full border border-wildcard px-8 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
                >
                  lock it in
                </button>
              </>
            )}
          </div>
        )}

        {/* ── higher / lower ── */}
        {q.qtype === "higher_lower" && (
          <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <p className="microlabel">{q.unit}</p>
                <p className="font-black">{q.subject_a}</p>
                <p className="tabular mt-1 text-2xl font-black" style={{ color: hex }}>
                  {q.value_a?.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: hex }}>
                <p className="microlabel">{q.unit}</p>
                <p className="font-black">{q.subject_b}</p>
                <p className="tabular mt-1 text-2xl font-black" style={{ color: hex }}>
                  {phase === "reveal" ? q.value_b?.toLocaleString() : "???"}
                </p>
              </div>
            </div>
            {phase === "play" && (
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={() => finishRound(q.correct === "higher" ? 100 : 0)}
                  className="microlabel rounded-full border border-sports px-6 py-3 text-sports transition hover:bg-sports hover:text-bg"
                >
                  ▲ higher
                </button>
                <button
                  onClick={() => finishRound(q.correct === "lower" ? 100 : 0)}
                  className="microlabel rounded-full border border-music px-6 py-3 text-music transition hover:bg-music hover:text-bg"
                >
                  ▼ lower
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── where ── */}
        {q.qtype === "where" && (
          <div className="mt-5">
            <WorldMap
              guess={pin}
              truth={phase === "reveal" ? truth : null}
              onPick={setPin}
              disabled={phase === "reveal"}
              accent={hex}
            />
            {phase === "play" && (
              <div className="mt-3 flex justify-center">
                <button
                  disabled={!pin}
                  onClick={() => pin && finishRound(mapPoints(haversineKm(pin, truth!)))}
                  className="microlabel rounded-full border border-wildcard px-8 py-3 text-wildcard transition enabled:hover:bg-wildcard enabled:hover:text-bg disabled:opacity-30"
                >
                  lock the pin
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "reveal" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center justify-center gap-5"
          >
            <span className="text-xl">{emoji(lastPts)}</span>
            <span className="text-2xl font-black" style={{ color: hex }}>
              +{lastPts}
            </span>
            <button
              onClick={nextRound}
              className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
            >
              {i + 1 >= rounds.length ? "see results" : "next →"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Results({
  dailyNumber,
  result,
  onShare,
  copied,
}: {
  dailyNumber: number;
  result: SavedResult;
  onShare: (r: SavedResult) => void;
  copied: boolean;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="microlabel">parlor daily #{dailyNumber}</p>
      <p className="display tabular text-8xl text-wildcard">{result.total}</p>
      <p className="mt-1 text-muted">out of 500</p>
      <p className="mt-4 text-3xl tracking-widest">{result.scores.map(emoji).join("")}</p>
      <button
        onClick={() => onShare(result)}
        className="microlabel mt-8 rounded-full border border-wildcard px-8 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
      >
        {copied ? "copied ✓" : "share result"}
      </button>
      <p className="microlabel mt-6">come back tomorrow — new gauntlet at midnight utc</p>
    </div>
  );
}
