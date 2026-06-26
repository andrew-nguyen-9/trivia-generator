"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import WorldMap from "@/components/WorldMap";
import GoogleMap from "@/components/GoogleMap";
import { haversineKm, mapPoints, type LatLng } from "@/lib/geo";
import { CATEGORY_HEX, CATEGORY_LABEL, type Question } from "@/lib/types";
import type { Civilization } from "@/lib/civilizations";
import { MAP_HOST } from "@/lib/civilizations";
import { usePractice } from "@/lib/usePractice";
import PracticeBar from "@/components/PracticeBar";
import { shuffled } from "@/lib/rng";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { buildShare, type GameResult, type Tier } from "@/lib/share";
import styles from "./MapGame.module.css";
import dynamic from "next/dynamic";
// code-split: the win-only canvas confetti is fetched on demand, not in
// the room's initial bundle (perf 2.16).
const Confetti = dynamic(() => import("@/components/Confetti"), { ssr: false });
import AchievementToast from "@/components/AchievementToast";
import LeaderboardPanel from "@/components/LeaderboardPanel";

// The Google Map component activates when this env var is present at build time.
const USE_GOOGLE = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY);

// One outcome per round — drives the share grid, the sfx, and the km-bar line
// from a single source. `km` is null on multiple-choice tangents (no distance).
interface RoundResult {
  tier: Tier;
  km: number | null;
}

// Tier bands match the in-round sfx thresholds in lock() so audio, the share
// grid, and the distance bars never disagree. ~535 km ⇒ hit, ~1,575 km ⇒ near.
const tierOf = (pts: number): Tier => (pts >= 70 ? "hit" : pts >= 35 ? "near" : "miss");

// Plain-language band for a raw km gap — the "clearer per-round km scoring" the
// §3.5 mandate asks for (a 1,240 km miss reads as "in the region" at a glance).
function bandLabel(km: number): string {
  if (km < 50) return "🎯 bullseye";
  if (km < 500) return "dead on";
  if (km < 1500) return "in the region";
  if (km < 4000) return "wrong continent";
  return "way off";
}

// ponytail: 2.75rem-wide bar columns can't hold "1,240 km" — compact to "1.2k".
const compactKm = (km: number): string =>
  km >= 1000 ? `${(km / 1000).toFixed(1)}k` : `${km}`;

const tierColor = (tier: Tier, accent: string): string =>
  tier === "hit" ? accent : tier === "near" ? "#c8852a" : "#7a4b4b";

export default function MapGame({
  rounds: initialRounds,
  pool,
  civ,
}: {
  rounds: Question[];
  pool?: Question[];
  civ?: Civilization;
}) {
  const reduced = useReducedMotion();
  const { practiceMode, togglePractice, saved, saveQ, removeQ, isSaved } = usePractice();
  const { record } = useProfile();

  const [rounds, setRounds] = useState(initialRounds);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [roundPts, setRoundPts] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [blur, setBlur] = useState(24);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const recorded = useRef(false);
  const raf = useRef<number>();
  const startedAt = useRef(0);

  useEffect(() => {
    if (!done || recorded.current) return;
    recorded.current = true;
    const win = score >= rounds.length * 55;
    if (win) {
      sfx.win();
      haptic.win();
      setBurst((b) => b + 1);
    } else {
      sfx.lose();
    }
    const unlocked = record({ room: "map", score, xp: score });
    if (unlocked.length) setToasts(unlocked);
  }, [done, score, rounds.length, record]);

  if (rounds.length === 0) {
    return (
      <p className="text-muted">The bank is still warming up — no pinnable facts yet.</p>
    );
  }

  const q = rounds[i];
  const isPin = q.qtype === "where";
  const isImage = q.qtype === "image_guess";
  const truth: LatLng = { lat: q.lat ?? 0, lng: q.lng ?? 0 };
  const km = guess ? Math.round(haversineKm(guess, truth)) : 0;
  const pts = guess ? mapPoints(km) : 0;
  const accent = civ?.accent ?? CATEGORY_HEX[q.category];

  // Artifact reveal (folded-in Gallery mechanic): the image sharpens over time;
  // an earlier correct identification keeps more of the blur-bonus.
  useEffect(() => {
    if (!isImage || locked || picked || reduced) {
      if (reduced) setBlur(0);
      return;
    }
    setBlur(24);
    startedAt.current = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - startedAt.current) / 6000);
      setBlur(24 * (1 - p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current ?? 0);
  }, [i, picked, locked, isImage, reduced]);

  function lock() {
    if (!guess) return;
    setLocked(true);
    setRoundPts(pts);
    setScore((s) => s + pts);
    setResults((r) => [...r, { tier: tierOf(pts), km }]);
    if (pts >= 70) {
      sfx.correct();
      haptic.correct();
    } else if (pts >= 35) {
      sfx.select();
    } else {
      sfx.wrong();
    }
  }

  function choose(choice: string) {
    if (picked) return;
    cancelAnimationFrame(raf.current ?? 0);
    setPicked(choice);
    setLocked(true);
    const right = choice === q.correct;
    // Image rounds keep the sharpen-bonus; plain trivia is flat 0/100.
    const gained = right ? (isImage ? Math.round(20 + 80 * (blur / 24)) : 100) : 0;
    setRoundPts(gained);
    setScore((s) => s + gained);
    setResults((r) => [...r, { tier: right ? "hit" : "miss", km: null }]);
    if (right) {
      sfx.correct();
      haptic.correct();
    } else {
      sfx.wrong();
      haptic.wrong();
    }
  }

  function next() {
    if (i + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setGuess(null);
    setPicked(null);
    setLocked(false);
  }

  function restart(newRounds?: Question[]) {
    const r = newRounds ?? rounds;
    setRounds(r);
    setI(0);
    setGuess(null);
    setPicked(null);
    setLocked(false);
    setScore(0);
    setResults([]);
    setDone(false);
    recorded.current = false;
  }

  const MapComponent = USE_GOOGLE ? GoogleMap : WorldMap;

  // The day's prompt card — shared by both pin and multiple-choice layouts.
  const promptCard = (
    <div
      className="rounded-2xl border bg-surface p-5"
      style={{ borderColor: `${accent}55` }}
    >
      <span className="microlabel" style={{ color: accent }}>
        {CATEGORY_LABEL[q.category]}
      </span>
      <p className="display mt-2 text-xl leading-tight sm:text-2xl">{q.prompt}</p>
    </div>
  );

  // Lock prompt / post-lock readout — lives in the side column on pin rounds.
  const pinControls = !locked ? (
    <div className="mt-4 text-center">
      <p className="microlabel">
        {guess ? "pin placed — sure?" : "click the map to drop your pin"}
      </p>
      <button
        onClick={lock}
        disabled={!guess}
        className="microlabel mt-3 rounded-full border border-geography px-8 py-3 text-geography transition enabled:hover:bg-geography enabled:hover:text-bg disabled:opacity-30"
      >
        lock it in
      </button>
    </div>
  ) : (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 text-center"
    >
      <p className="text-muted">
        <span className="font-black text-ink">{q.correct}</span> was{" "}
        <span className="tabular font-black text-ink">{km.toLocaleString()} km</span>{" "}
        from your pin
      </p>
      {/* Proximity meter + band label: the clearer per-round km scoring. */}
      <div className="mx-auto mt-3 max-w-xs">
        <div className="h-2 w-full overflow-hidden rounded-full border border-line bg-surface">
          <div
            className={styles.proxFill}
            style={{ width: `${roundPts}%`, backgroundColor: accent }}
          />
        </div>
        <p className="microlabel mt-1" style={{ color: accent }}>
          {bandLabel(km)}
        </p>
      </div>
      <p className="mt-2 text-2xl font-black text-geography">+{roundPts} pts</p>
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
          className="microlabel mt-4 rounded-full border border-ink px-8 py-3 transition hover:bg-ink hover:text-bg"
        >
          {i + 1 >= rounds.length ? "finish" : "next →"}
        </button>
      </div>
    </motion.div>
  );

  if (done) {
    // The per-round distance line → tiers for the §3.0 share seam. `date` is a
    // cosmetic label; the board is day-seeded upstream so a client Date() on
    // this click is hydration-safe. ponytail: client Date() — page.tsx isn't ours.
    const result: GameResult = {
      room: "/map",
      date: new Date().toISOString().slice(0, 10),
      tiers: results.map((r) => r.tier),
      score,
      maxScore: rounds.length * 100,
      columns: rounds.length,
    };
    const card = buildShare(result);
    const shareResult = () => {
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          void navigator.share({ text: card.text, url: card.url }).catch(() => {});
        } else {
          void navigator.clipboard?.writeText(card.text);
        }
      } catch {
        /* clipboard/share unavailable — silently no-op */
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <>
        <Confetti trigger={burst} />
        <AchievementToast queue={toasts} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="microlabel">final score</p>
          <p className="display tabular text-8xl text-geography">{score}</p>
          <p className="mt-2 text-muted">out of {rounds.length * 100}</p>

          {/* The per-round distance line (km bars) — the §3.5 social artifact. */}
          <p className="microlabel mt-8 text-muted">your expedition</p>
          <div className={`mt-2 ${styles.bars}`} aria-label="distance per round">
            {results.map((r, idx) => {
              // floor the fill so a played-but-far round still shows a coloured
              // stub (distinct from an unplayed track), not a near-empty bar.
              const fill = r.km == null ? (r.tier === "hit" ? 100 : 12) : Math.max(8, mapPoints(r.km));
              return (
                <div key={idx} className={styles.barCol}>
                  <div className={`${styles.barTrack} border border-line bg-surface`}>
                    <div
                      className={styles.barFill}
                      style={{ height: `${fill}%`, backgroundColor: tierColor(r.tier, accent) }}
                    />
                  </div>
                  <span className="tabular text-[0.6rem] text-muted">
                    {r.km == null ? (r.tier === "hit" ? "✓" : "✗") : compactKm(r.km)}
                  </span>
                </div>
              );
            })}
          </div>

          <LeaderboardPanel room="map" score={score} accent="geography" />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={shareResult}
              className="microlabel rounded-full border border-geography px-6 py-3 text-geography transition hover:bg-geography hover:text-bg"
            >
              {copied ? "copied ✓" : "share expedition"}
            </button>
            <button
              onClick={() => restart()}
              className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
            >
              new expedition
            </button>
            {practiceMode && pool && pool.length > 5 && (
              <button
                onClick={() => {
                  const fresh = shuffled([...pool], () => Math.random()).slice(0, 5);
                  restart(fresh);
                }}
                className="microlabel rounded-full border border-wildcard px-6 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
              >
                ↻ new round
              </button>
            )}
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

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">Atlas Obscura</h1>
        <div className="text-right">
          <div className="microlabel">
            round {i + 1}/{rounds.length} · score
          </div>
          <div className="tabular text-3xl font-black text-geography">{score}</div>
        </div>
      </div>

      {/* Antique nameplate: the day's civilization + the Cartographer's seal ring. */}
      {civ && (
        <div
          className="mt-4 flex items-center gap-3 rounded-2xl border bg-surface px-5 py-3"
          style={{ borderColor: accent }}
        >
          <span
            className="grid h-10 w-10 place-items-center rounded-full border text-xl"
            style={{ borderColor: accent, color: accent }}
            aria-hidden
          >
            {civ.glyph}
          </span>
          <div>
            <div className="microlabel" style={{ color: accent }}>
              civilization of the day · {civ.era}
            </div>
            <div className="display text-lg leading-tight">{civ.name}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="microlabel text-muted">{MAP_HOST.name}</div>
          </div>
        </div>
      )}

      {isPin ? (
        // One-screen pin round: map on the left, prompt + controls on the right.
        <div className={styles.layout}>
          <MapComponent
            guess={guess}
            truth={locked ? truth : null}
            onPick={setGuess}
            disabled={locked}
            accent={accent}
          />
          <div>
            {promptCard}
            {pinControls}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">{promptCard}</div>

          {isImage && q.image_url && (
            <div className="mt-4 flex justify-center">
              <div
                className="relative overflow-hidden rounded-2xl border bg-bg"
                style={{ borderColor: accent }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={q.image_url}
                  alt="identify the artifact"
                  className="h-64 w-auto max-w-full object-contain transition-[filter] sm:h-80"
                  style={{ filter: `blur(${blur.toFixed(1)}px)` }}
                  draggable={false}
                />
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(q.choices ?? []).map((choice) => {
              const isCorrect = choice === q.correct;
              const isThis = choice === picked;
              const cls = picked
                ? isCorrect
                  ? "border-sports bg-sports/15 text-sports"
                  : isThis
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
                  {picked && isThis && !isCorrect && " ✗"}
                </button>
              );
            })}
          </div>

          {locked && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 text-center"
            >
              <p className="text-muted">
                answer: <span className="font-black text-ink">{q.correct}</span>
              </p>
              <p className="mt-1 text-2xl font-black text-geography">+{roundPts} pts</p>
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
                  className="microlabel mt-4 rounded-full border border-ink px-8 py-3 transition hover:bg-ink hover:text-bg"
                >
                  {i + 1 >= rounds.length ? "finish" : "next →"}
                </button>
              </div>
            </motion.div>
          )}
        </>
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
