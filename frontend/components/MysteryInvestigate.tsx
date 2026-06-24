"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sfxCorrect, sfxGlassClink, sfxPianoChord, sfxWrong } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { deductionMatrix, HOURS, ROOMS, pretty, type MysteryCase } from "@/lib/mystery";
import { score, type MysteryAttempt, type MysteryScoreResult } from "@/lib/mysteryScore";
import MysteryAccusationForm from "./MysteryAccusationForm";
import { nextTag, type SuspectTag } from "./MysteryStatusPill";
import AchievementToast from "./AchievementToast";

export interface StoredMysteryAttempt {
  attempt: MysteryAttempt;
  result: MysteryScoreResult;
  at: number;
}

const TAG_STYLE: Record<"potential" | "prime" | "cleared", string> = {
  potential: "border-gold/55 text-gold",
  prime: "border-ember bg-ember/15 text-ink",
  cleared: "border-line text-muted bg-surface/70 opacity-60",
};
const TAG_LABEL = { potential: "PERSON OF INTEREST", prime: "ACCUSE", cleared: "CLEARED" } as const;

// Stable colour per room so the alibi grid is scannable — same room, same tint.
// The player reads the fatal-hour column and spots which tint appears alone.
const ROOM_TINT = [
  "bg-[#3a2a1a] text-amber-100",
  "bg-[#1f2e2a] text-emerald-100",
  "bg-[#2a1f33] text-violet-100",
  "bg-[#33231f] text-rose-100",
  "bg-[#1f2733] text-sky-100",
  "bg-[#2e2a1a] text-yellow-100",
];

const shortRoom = (r: string) => r.replace(/^the /, "");
const displayRoom = (r: string) => r.replace(/^the /, "The ");

export default function MysteryInvestigate({
  mystery,
  onSolved,
}: {
  mystery: MysteryCase;
  onSolved: (stored: StoredMysteryAttempt) => void;
}) {
  const { record } = useProfile();
  const [cluesRevealed, setCluesRevealed] = useState(1);
  const [tags, setTags] = useState<Record<string, SuspectTag>>({});
  const [whereGuess, setWhereGuess] = useState<string | null>(null);
  const [whenGuess, setWhenGuess] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const startedAt = useRef(Date.now());

  const whoGuess = useMemo(
    () => mystery.suspects.filter((s) => tags[s.id] === "prime").map((s) => s.id),
    [mystery.suspects, tags],
  );

  // The elimination grid as of the clues revealed. Once a single hour survives,
  // its column lights up on the alibi board — that's the cue to hunt the loner.
  const matrix = useMemo(() => deductionMatrix(mystery, cluesRevealed), [mystery, cluesRevealed]);
  const survivingRooms = ROOMS.map((_, i) => i).filter((i) => !matrix[i].every((c) => c === "ruled-out"));
  const survivingHours = HOURS.map((_, h) => h).filter((h) => !matrix.every((row) => row[h] === "ruled-out"));
  const lockedHour = survivingHours.length === 1 ? survivingHours[0] : null;
  const lockedRoom = survivingRooms.length === 1 ? survivingRooms[0] : null;

  // room → tint index, by ROOMS order (stable for the day)
  const tintFor = (room: string) => ROOM_TINT[ROOMS.indexOf(room as (typeof ROOMS)[number]) % ROOM_TINT.length];

  function cycleTag(id: string) {
    setTags((t) => ({ ...t, [id]: nextTag(t[id]) }));
    sfxGlassClink();
  }
  function revealNext() {
    setCluesRevealed((r) => Math.min(mystery.clues.length, r + 1));
    sfxPianoChord();
  }
  function relationshipToVictim(id: string): string {
    const edge = mystery.dossiers[id]?.relationships.find((r) => r.to === mystery.victim.id);
    return edge ? edge.kind : "no known tie to the victim";
  }

  function submit() {
    const elapsedSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    const attempt: MysteryAttempt = {
      whoGuess,
      whereGuess,
      whenGuess,
      cluesRevealed,
      elapsedSeconds,
      tableTags: tags,
      autoMarkUsed: false,
    };
    const result = score(mystery, attempt);
    if (result.won) { sfxCorrect(); haptic.win(); } else { sfxWrong(); haptic.wrong(); }
    const unlocked = record({ room: "mystery", score: result.total, correct: result.won ? 1 : 0, total: 1 });
    if (unlocked.length) setToasts(unlocked);
    onSolved({ attempt, result, at: Date.now() });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      {/* ── Case header · the all-seeing eye ─────────────────────────────── */}
      <header className="pt-6 text-center">
        <div className="mb-2 text-3xl text-gold/80" aria-hidden>𓂀</div>
        <p className="microlabel text-brass">case #{mystery.caseNumber}</p>
        <h2 className="display gilt mt-1 text-3xl sm:text-4xl">{mystery.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink/85">{mystery.opening}</p>
      </header>

      {/* ── 1 · The Suspects ─────────────────────────────────────────────── */}
      <Section step={1} title="The Suspects" hint="Tap a card to mark it. Tap the name to read the dossier.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {mystery.suspects.map((s) => {
            const tag = tags[s.id];
            const open = expanded === s.id;
            return (
              <div
                key={s.id}
                className={`rounded-xl border p-3 transition ${tag ? TAG_STYLE[tag] : "border-line bg-surface/50"}`}
              >
                <button onClick={() => cycleTag(s.id)} className="flex w-full items-center gap-2 text-left">
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{pretty(s.id)}</span>
                    <span className="block truncate text-[11px] text-muted">{s.title}</span>
                  </span>
                </button>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="microlabel text-[9px] text-muted">{tag ? TAG_LABEL[tag] : "tap to mark"}</span>
                  <button
                    onClick={() => setExpanded(open ? null : s.id)}
                    className="text-[11px] text-muted underline-offset-2 hover:text-gold hover:underline"
                  >
                    {open ? "hide" : "dossier"}
                  </button>
                </div>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-2 text-[11px] italic leading-snug text-ink/70">{s.trait}</p>
                      <p className="mt-1 text-[11px] text-ink/60">Always carries {s.quirk}.</p>
                      <p className="mt-1 text-[11px] text-ember/80">To the victim: {relationshipToVictim(s.id)}.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── 2 · The Evidence Ledger + WHERE/WHEN elimination ─────────────── */}
      <Section
        step={2}
        title="The Evidence Ledger"
        hint={`${cluesRevealed}/${mystery.clues.length} revealed · each new clue costs points`}
      >
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {mystery.clues.slice(0, cluesRevealed).map((clue) => (
              <motion.div
                key={clue.stage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-line bg-bg/40 p-4"
              >
                <p className="microlabel text-ember">{clue.kind}</p>
                <p className="display mt-1 text-base">{clue.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/85">{clue.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {cluesRevealed < mystery.clues.length && (
            <button
              onClick={revealNext}
              className="microlabel rounded-full border border-line px-5 py-2 text-muted transition hover:border-gold hover:text-gold"
            >
              ✦ reveal next clue (−points)
            </button>
          )}
        </div>

        {/* room × hour elimination — the WHERE/WHEN board */}
        <div className="mt-5">
          <p className="microlabel mb-2 text-muted">where &amp; when — rule it out</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center text-[11px]">
              <thead>
                <tr>
                  <th className="p-1" />
                  {HOURS.map((h, hi) => (
                    <th
                      key={h}
                      className={`p-1 font-normal ${lockedHour === hi ? "text-gold" : "text-muted"}`}
                    >
                      {h.replace(":00", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROOMS.map((room, ri) => (
                  <tr key={room}>
                    <td className={`whitespace-nowrap py-1 pr-2 text-right ${lockedRoom === ri ? "text-gold" : "text-muted"}`}>
                      {shortRoom(room)}
                    </td>
                    {HOURS.map((_, hi) => {
                      const cell = matrix[ri][hi];
                      return (
                        <td key={hi} className="p-0.5">
                          <span
                            className={`flex h-5 w-full items-center justify-center rounded ${
                              cell === "ruled-out"
                                ? "bg-bg/30 text-muted/30"
                                : cell === "confirmed"
                                  ? "bg-ember/25 text-ember"
                                  : "border border-line/60 text-muted"
                            }`}
                          >
                            {cell === "ruled-out" ? "·" : cell === "confirmed" ? "✦" : ""}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── 3 · The Alibi Board — the WHO puzzle ─────────────────────────── */}
      <Section
        step={3}
        title="The Alibi Board"
        hint={
          lockedHour !== null
            ? `At ${HOURS[lockedHour]} the innocent pair up — find the guest who stands alone.`
            : "Each guest's claimed room, hour by hour. Pin down the fatal hour first."
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-[11px]">
            <thead>
              <tr>
                <th className="p-1 text-left" />
                {HOURS.map((h, hi) => (
                  <th
                    key={h}
                    className={`p-1 font-normal ${lockedHour === hi ? "text-gold underline decoration-ember" : "text-muted"}`}
                  >
                    {h.replace(":00", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mystery.suspects.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap py-1 pr-2 text-left text-ink">
                    <span className="mr-1">{s.emoji}</span>
                    <span className="hidden sm:inline">{pretty(s.id)}</span>
                  </td>
                  {HOURS.map((_, hi) => {
                    const room = mystery.dossiers[s.id].claimed[hi];
                    const isFatal = lockedHour === hi;
                    return (
                      <td key={hi} className="p-0.5">
                        <span
                          className={`block truncate rounded px-1 py-1 ${tintFor(room)} ${
                            isFatal ? "ring-1 ring-gold" : "opacity-70"
                          }`}
                          title={displayRoom(room)}
                        >
                          {shortRoom(room)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Same colour = same room. In the fatal-hour column, the guilty are the ones whose colour appears <em>only once</em>.
        </p>
      </Section>

      {/* ── 4 · The Accusation ───────────────────────────────────────────── */}
      <Section step={4} title="The Accusation" hint="Name the guilty, the room, and the hour.">
        <MysteryAccusationForm
          mystery={mystery}
          whoGuess={whoGuess}
          whereGuess={whereGuess}
          whenGuess={whenGuess}
          onWhereChange={setWhereGuess}
          onWhenChange={setWhenGuess}
          onSubmit={submit}
        />
      </Section>

      <AchievementToast queue={toasts} />
    </div>
  );
}

function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="display gilt text-xl tabular-nums">{step}</span>
        <h3 className="display text-lg text-ink">{title}</h3>
      </div>
      <p className="microlabel mb-3 text-muted">{hint}</p>
      {children}
    </section>
  );
}
