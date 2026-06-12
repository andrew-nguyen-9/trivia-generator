"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import WorldMap from "@/components/WorldMap";
import { haversineKm, mapPoints, type LatLng } from "@/lib/geo";
import { CATEGORY_HEX, CATEGORY_LABEL, type Question } from "@/lib/types";

export default function MapGame({ rounds }: { rounds: Question[] }) {
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (rounds.length === 0) {
    return <p className="text-muted">The bank is still warming up — no pinnable facts yet.</p>;
  }

  const q = rounds[i];
  const truth: LatLng = { lat: q.lat!, lng: q.lng! };
  const km = guess ? Math.round(haversineKm(guess, truth)) : 0;
  const pts = guess ? mapPoints(km) : 0;
  const hex = CATEGORY_HEX[q.category];

  function lock() {
    if (!guess) return;
    setLocked(true);
    setScore((s) => s + pts);
  }

  function next() {
    if (i + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setGuess(null);
    setLocked(false);
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="microlabel">final score</p>
        <p className="display tabular text-8xl text-geography">{score}</p>
        <p className="mt-2 text-muted">out of {rounds.length * 100}</p>
        <button
          onClick={() => {
            setI(0);
            setGuess(null);
            setLocked(false);
            setScore(0);
            setDone(false);
          }}
          className="microlabel mt-8 rounded-full border border-ink px-6 py-3 transition hover:bg-ink hover:text-bg"
        >
          new expedition
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl sm:text-5xl">The Map</h1>
        <div className="text-right">
          <div className="microlabel">round {i + 1}/{rounds.length} · score</div>
          <div className="tabular text-3xl font-black text-geography">{score}</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <span className="microlabel" style={{ color: hex }}>
          {CATEGORY_LABEL[q.category]}
        </span>
        <p className="display mt-2 text-xl leading-tight sm:text-2xl">{q.prompt}</p>
      </div>

      <div className="mt-4">
        <WorldMap
          guess={guess}
          truth={locked ? truth : null}
          onPick={setGuess}
          disabled={locked}
          accent={hex}
        />
      </div>

      {!locked ? (
        <div className="mt-5 flex items-center justify-center gap-4">
          <p className="microlabel">{guess ? "pin placed — sure?" : "click the map to drop your pin"}</p>
          <button
            onClick={lock}
            disabled={!guess}
            className="microlabel rounded-full border border-geography px-8 py-3 text-geography transition enabled:hover:bg-geography enabled:hover:text-bg disabled:opacity-30"
          >
            lock it in
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 text-center"
        >
          <p className="text-muted">
            <span className="font-black text-ink">{q.correct}</span> was{" "}
            <span className="tabular font-black text-ink">{km.toLocaleString()} km</span> from your pin
          </p>
          <p className="mt-1 text-2xl font-black text-geography">+{pts} pts</p>
          {q.source_url && (
            <a href={q.source_url} target="_blank" rel="noreferrer" className="microlabel underline">
              source
            </a>
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
    </div>
  );
}
