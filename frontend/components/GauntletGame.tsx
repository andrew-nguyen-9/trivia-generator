"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import WorldMap from "@/components/WorldMap";
import { haversineKm, type LatLng } from "@/lib/geo";
import { CATEGORY_HEX, CATEGORY_LABEL, type Question } from "@/lib/types";

// THE GAUNTLET — an Indiana-Jones treasure run across the rooms. The clock runs
// from the first trial to the last; your TIME is your score (lower is better).
// Hints cost time. A sprung trap (wrong answer / a guess outside tolerance) costs
// time too. Folds in the Blitz sprint: one continuous clock, no second chances.

const HINT_PENALTY = 30_000; // ms added for asking the Adventurer for help
const TRAP_PENALTY = 20_000; // ms added when a trap springs (wrong / off-target)
const YEAR_TOLERANCE = 4; // within N years clears the gate
const WHERE_TOLERANCE_KM = 800; // within N km clears the gate

const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear();

// expedition framing per qtype — the trial each room becomes
const TRIAL: Record<string, { name: string; obstacle: string }> = {
  multiple_choice: { name: "The Collapsing Bridge", obstacle: "⛓️" },
  year_guess: { name: "The Sundial Gate", obstacle: "⏳" },
  higher_lower: { name: "The Scales of Judgement", obstacle: "⚖️" },
  where: { name: "The Cartographer's Trial", obstacle: "🗺️" },
  clue: { name: "The Riddle Door", obstacle: "🗝️" },
};

type Phase = "brief" | "running" | "reveal" | "done";

interface Saved {
  totalMs: number;
  marks: string[]; // per-trial: "⛏️" clean · "💡" hinted · "🪤" trapped
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

export default function GauntletGame({
  rounds,
  gauntletNumber,
}: {
  rounds: Question[];
  gauntletNumber: number;
}) {
  const storageKey = `parlor:gauntlet:${gauntletNumber}`;
  const [phase, setPhase] = useState<Phase>("brief");
  const [i, setI] = useState(0);
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [marks, setMarks] = useState<string[]>([]);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // live clock
  const startRef = useRef(0);
  const [now, setNow] = useState(0);

  // per-trial input
  const [picked, setPicked] = useState<string | null>(null);
  const [year, setYear] = useState(1970);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [lastTrap, setLastTrap] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) setSaved(JSON.parse(raw));
    setLoaded(true);
  }, [storageKey]);

  // tick the live clock while running
  useEffect(() => {
    if (phase !== "running" && phase !== "reveal") return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [phase]);

  const q = rounds[i];
  const choices = useMemo(() => q?.choices ?? [], [q]);

  if (!loaded) return null;
  if (rounds.length < 5) {
    return <p className="text-muted">The bank is still warming up — the gauntlet needs all five trials stocked.</p>;
  }
  if (saved && phase !== "done") return <Results n={gauntletNumber} saved={saved} onShare={share} copied={copied} />;
  if (phase === "done" && saved) return <Results n={gauntletNumber} saved={saved} onShare={share} copied={copied} />;

  const liveMs = startRef.current ? now - startRef.current + penaltyMs : 0;

  function begin() {
    startRef.current = Date.now();
    setNow(Date.now());
    setPhase("running");
  }

  function resetTrial() {
    setPicked(null);
    setYear(1970);
    setPin(null);
    setHintUsed(false);
    setEliminated([]);
  }

  function askHint() {
    if (hintUsed) return;
    setHintUsed(true);
    setPenaltyMs((p) => p + HINT_PENALTY);
    // the Collapsing Bridge: the Adventurer kicks away two rotten planks
    if (q.qtype === "multiple_choice") {
      const wrong = choices.filter((c) => c !== q.correct);
      setEliminated(wrong.slice(0, Math.min(2, wrong.length)));
    }
  }

  // resolve the current trial: clean clears the gate, trap adds time
  function resolve(clean: boolean) {
    const trapped = !clean;
    if (trapped) setPenaltyMs((p) => p + TRAP_PENALTY);
    setLastTrap(trapped);
    setMarks((m) => [...m, hintUsed ? "💡" : trapped ? "🪤" : "⛏️"]);
    setPhase("reveal");
  }

  function next() {
    if (i + 1 >= rounds.length) {
      const totalMs = Date.now() - startRef.current + penaltyMs;
      const result: Saved = { totalMs, marks };
      localStorage.setItem(storageKey, JSON.stringify(result));
      setSaved(result);
      setPhase("done");
      return;
    }
    setI(i + 1);
    resetTrial();
    setPhase("running");
  }

  async function share(r: Saved) {
    const line = `PARLOR GAUNTLET #${gauntletNumber} — escaped in ${fmt(r.totalMs)}\n${r.marks.join("")}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the text is on screen anyway */
    }
  }

  // ── the briefing ──────────────────────────────────────────────────────────
  if (phase === "brief") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="text-4xl">𖣘</div>
        <h1 className="display mt-3 text-5xl sm:text-6xl">The Gauntlet</h1>
        <p className="microlabel mt-2 text-wildcard">run #{gauntletNumber} · the same temple for everyone today</p>
        <p className="mt-4 max-w-md text-muted">
          Five trials stand between you and the relic. The clock runs the whole way —
          your <span className="text-ink">time is your score</span>, so move. A sprung
          trap costs {TRAP_PENALTY / 1000}s. The Adventurer will whisper a hint, but
          every hint costs you {HINT_PENALTY / 1000}s.
        </p>
        <p className="mt-3 max-w-md text-sm italic text-muted/80">
          &ldquo;Fortune favours the fast. Touch nothing you don&rsquo;t have to.&rdquo; — the Adventurer
        </p>
        <button
          onClick={begin}
          className="microlabel mt-8 rounded-full border border-wildcard px-10 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
        >
          enter the temple
        </button>
      </div>
    );
  }

  const hex = CATEGORY_HEX[q.category];
  const trial = TRIAL[q.qtype] ?? { name: "The Trial", obstacle: "⛏️" };
  const truth: LatLng | null = q.qtype === "where" ? { lat: q.lat!, lng: q.lng! } : null;

  return (
    <div>
      {/* clock + path */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="display text-3xl sm:text-4xl">The Gauntlet</h1>
          <p className="microlabel mt-1">
            {trial.obstacle} {trial.name} · trial {i + 1}/5
          </p>
        </div>
        <div className="text-right">
          <div className="microlabel">time</div>
          <div className="tabular text-5xl font-black text-wildcard">{fmt(liveMs)}</div>
        </div>
      </div>

      <div className="mt-2 flex gap-1 text-lg">
        {rounds.map((r, k) => (
          <span key={k} className={k < marks.length ? "" : k === i ? "opacity-100" : "opacity-30"}>
            {k < marks.length ? marks[k] : (TRIAL[r.qtype]?.obstacle ?? "·")}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-6">
        <span className="microlabel" style={{ color: hex }}>
          {CATEGORY_LABEL[q.category]} · {trial.name}
        </span>
        <p className="display mt-2 text-xl leading-tight sm:text-2xl">{q.prompt}</p>

        {/* ── multiple choice ── */}
        {q.qtype === "multiple_choice" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {choices.map((c) => {
              const isOut = eliminated.includes(c);
              const cls =
                phase === "reveal"
                  ? c === q.correct
                    ? "border-sports bg-sports/15 text-sports"
                    : c === picked
                      ? "border-music bg-music/15 text-music"
                      : "border-line text-muted"
                  : isOut
                    ? "border-line text-muted/30 line-through"
                    : "border-line hover:border-ink";
              return (
                <button
                  key={c}
                  disabled={phase === "reveal" || isOut}
                  onClick={() => {
                    setPicked(c);
                    resolve(c === q.correct);
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
            {hintUsed && phase === "running" && q.year != null && (
              <p className="microlabel mt-2 text-wildcard">the Sundial points to the {Math.floor(q.year / 10) * 10}s</p>
            )}
            {phase === "running" && (
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
                  onClick={() => resolve(Math.abs(year - (q.year ?? 0)) <= YEAR_TOLERANCE)}
                  className="microlabel mt-4 rounded-full border border-wildcard px-8 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
                >
                  set the dial
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
                <p className="tabular mt-1 text-2xl font-black" style={{ color: hex }}>{q.value_a?.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: hex }}>
                <p className="microlabel">{q.unit}</p>
                <p className="font-black">{q.subject_b}</p>
                <p className="tabular mt-1 text-2xl font-black" style={{ color: hex }}>
                  {phase === "reveal" ? q.value_b?.toLocaleString() : "???"}
                </p>
              </div>
            </div>
            {hintUsed && phase === "running" && (
              <p className="microlabel mt-3 text-center text-wildcard">
                the Scales tip {q.correct === "higher" ? "up ▲" : "down ▼"}
              </p>
            )}
            {phase === "running" && (
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={() => resolve(q.correct === "higher")}
                  className="microlabel rounded-full border border-sports px-6 py-3 text-sports transition hover:bg-sports hover:text-bg"
                >
                  ▲ higher
                </button>
                <button
                  onClick={() => resolve(q.correct === "lower")}
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
            {hintUsed && phase === "running" && truth && (
              <p className="microlabel mb-2 text-center text-wildcard">
                the map names the {truth.lat >= 0 ? "northern" : "southern"} & {truth.lng >= 0 ? "eastern" : "western"} reaches
              </p>
            )}
            <WorldMap
              guess={pin}
              truth={phase === "reveal" ? truth : null}
              onPick={setPin}
              disabled={phase === "reveal"}
              accent={hex}
            />
            {phase === "running" && (
              <div className="mt-3 flex justify-center">
                <button
                  disabled={!pin}
                  onClick={() => pin && resolve(haversineKm(pin, truth!) <= WHERE_TOLERANCE_KM)}
                  className="microlabel rounded-full border border-wildcard px-8 py-3 text-wildcard transition enabled:hover:bg-wildcard enabled:hover:text-bg disabled:opacity-30"
                >
                  plant the flag
                </button>
              </div>
            )}
          </div>
        )}

        {/* hint button — only while answering, once per trial */}
        {phase === "running" && !hintUsed && (
          <button
            onClick={askHint}
            className="microlabel mt-5 rounded-full border border-line px-5 py-2 text-muted transition hover:border-wildcard hover:text-wildcard"
          >
            💡 ask the Adventurer (+{HINT_PENALTY / 1000}s)
          </button>
        )}

        {phase === "reveal" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center justify-center gap-5"
          >
            <span className="text-xl">{lastTrap ? "🪤 trap sprung" : "⛏️ cleared"}</span>
            <button
              onClick={next}
              className="microlabel rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
            >
              {i + 1 >= rounds.length ? "claim the relic" : "press on →"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Results({
  n,
  saved,
  onShare,
  copied,
}: {
  n: number;
  saved: Saved;
  onShare: (r: Saved) => void;
  copied: boolean;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="microlabel">parlor gauntlet #{n}</p>
      <div className="mt-2 text-4xl">𖣘</div>
      <p className="display tabular text-7xl text-wildcard">{fmt(saved.totalMs)}</p>
      <p className="mt-1 text-muted">out of the temple</p>
      <p className="mt-4 text-3xl tracking-widest">{saved.marks.join("")}</p>
      <button
        onClick={() => onShare(saved)}
        className="microlabel mt-8 rounded-full border border-wildcard px-8 py-3 text-wildcard transition hover:bg-wildcard hover:text-bg"
      >
        {copied ? "copied ✓" : "share result"}
      </button>
      <p className="microlabel mt-6">come back tomorrow — a new temple at midnight utc</p>
    </div>
  );
}
