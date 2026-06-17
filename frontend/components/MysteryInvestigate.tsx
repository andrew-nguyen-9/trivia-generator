"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sfxCorrect, sfxGlassClink, sfxPianoChord, sfxWrong } from "@/lib/sound";
import { haptic } from "@/lib/haptics";
import { useProfile, type Achievement } from "@/lib/profile";
import { deductionMatrix, HOURS, seedFromDate, type MysteryCase } from "@/lib/mystery";
import { mulberry32 } from "@/lib/rng";
import { enrichCase } from "@/lib/mysteryEnrich";
import type { MysteryContext } from "@/lib/mysteryTypes";
import { score, type MysteryAttempt, type MysteryScoreResult } from "@/lib/mysteryScore";
import MysteryEvidenceLog from "./MysteryEvidenceLog";
import MysteryAccusationForm from "./MysteryAccusationForm";
import MysteryAlibiTracker from "./MysteryAlibiTracker";
import MysteryMapView from "./MysteryMapView";
import MysteryRelationshipMap from "./MysteryRelationshipMap";
import { nextTag, type SuspectTag } from "./MysteryStatusPill";
import AchievementToast from "./AchievementToast";

export interface StoredMysteryAttempt {
  attempt: MysteryAttempt;
  result: MysteryScoreResult;
  at: number;
}

type MainTab = "relationship-map" | "alibi-tracker" | "map-view";
type MobileTab = "relationship-map" | "alibi-tracker" | "map-view" | "evidence";

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: "relationship-map", label: "⬡ Relationship Map" },
  { key: "alibi-tracker",   label: "⊞ Alibi Tracker" },
  { key: "map-view",        label: "≡ Map View" },
];

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
  const [mainTab, setMainTab] = useState<MainTab>("alibi-tracker");
  const [mobileTab, setMobileTab] = useState<MobileTab>("alibi-tracker");
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [context, setContext] = useState<MysteryContext>({ byCharacter: {}, loaded: false });
  const [autoMarkUsed, setAutoMarkUsed] = useState(false);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const startedAt = useRef(Date.now());

  function handleNoteChange(key: string, val: string) {
    setNotesMap((prev) => ({ ...prev, [key]: val }));
  }

  useEffect(() => {
    const rnd = mulberry32(seedFromDate(mystery.date));
    enrichCase(mystery, rnd).then(setContext);
  }, [mystery.date]);

  const whoGuess = useMemo(
    () => mystery.suspects.filter((s) => tags[s.id] === "prime").map((s) => s.id),
    [mystery.suspects, tags]
  );

  function cycleTag(id: string) {
    setTags((t) => ({ ...t, [id]: nextTag(t[id]) }));
    sfxGlassClink();
  }

  function revealNext() {
    setCluesRevealed((r) => Math.min(mystery.clues.length, r + 1));
    sfxPianoChord();
  }

  function handleAutoMark() {
    if (autoMarkUsed) return;
    const matrix = deductionMatrix(mystery, cluesRevealed);
    let confirmedHourIdx: number | null = null;
    for (let h = 0; h < HOURS.length; h++) {
      if (matrix.some((row) => row[h] === "confirmed")) {
        confirmedHourIdx = h;
        break;
      }
    }
    setTags((prev) => {
      const next = { ...prev };
      for (const s of mystery.suspects) {
        const allVerified = HOURS.every((_, h) => {
          if (!context.loaded) return false;
          const charCtx = context.byCharacter[s.id];
          if (!charCtx) return false;
          const hourLabel = HOURS[h];
          const selfCorroborated = charCtx.witnesses.some(
            (w) => w.statementType === "true" && w.hour === hourLabel
          );
          const crossConfirmed = mystery.suspects.some((other) => {
            if (other.id === s.id) return false;
            return context.byCharacter[other.id]?.witnesses.some(
              (w) =>
                w.aboutCharacter === s.id &&
                w.statementType === "true" &&
                w.hour === hourLabel
            );
          });
          return selfCorroborated || crossConfirmed;
        });
        if (allVerified) {
          next[s.id] = "cleared";
          continue;
        }
        if (confirmedHourIdx !== null) {
          const hourLabel = HOURS[confirmedHourIdx];
          const charCtx = context.byCharacter[s.id];
          const hasWitness =
            charCtx?.witnesses.some(
              (w) => w.statementType === "true" && w.hour === hourLabel
            ) ||
            mystery.suspects.some((other) => {
              if (other.id === s.id) return false;
              return context.byCharacter[other.id]?.witnesses.some(
                (w) =>
                  w.aboutCharacter === s.id &&
                  w.statementType === "true" &&
                  w.hour === hourLabel
              );
            });
          if (!hasWitness) next[s.id] = "potential";
        }
      }
      return next;
    });
    setAutoMarkUsed(true);
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
      autoMarkUsed,
    };
    const result = score(mystery, attempt);
    if (result.won) {
      sfxCorrect();
      haptic.win();
    } else {
      sfxWrong();
      haptic.wrong();
    }
    const unlocked = record({
      room: "mystery",
      score: result.total,
      correct: result.won ? 1 : 0,
      total: 1,
    });
    if (unlocked.length) setToasts(unlocked);
    onSolved({ attempt, result, at: Date.now() });
  }

  function renderMainTab(tab: MainTab) {
    if (tab === "relationship-map") {
      return (
        <MysteryRelationshipMap mystery={mystery} context={context} />
      );
    }
    if (tab === "alibi-tracker") {
      return (
        <MysteryAlibiTracker
          mystery={mystery}
          context={context}
          cluesRevealed={cluesRevealed}
          tags={tags}
          onCycleTag={cycleTag}
          onAutoMark={handleAutoMark}
          autoMarkUsed={autoMarkUsed}
          notesMap={notesMap}
          onNoteChange={handleNoteChange}
        />
      );
    }
    return (
      <MysteryMapView mystery={mystery} context={context} />
    );
  }

  const evidencePanel = (
    <>
      <MysteryEvidenceLog
        mystery={mystery}
        cluesRevealed={cluesRevealed}
        onRevealNext={revealNext}
      />
      <MysteryAccusationForm
        mystery={mystery}
        whoGuess={whoGuess}
        whereGuess={whereGuess}
        whenGuess={whenGuess}
        onWhereChange={setWhereGuess}
        onWhenChange={setWhenGuess}
        onSubmit={submit}
      />
    </>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-baseline justify-between">
        <h2 className="display gilt text-3xl">{mystery.title}</h2>
        <span className="microlabel text-brass">case #{mystery.caseNumber}</span>
      </div>

      {/* Desktop layout: full-width tab panel + right sidebar */}
      <div className="mt-6 hidden lg:flex lg:gap-6">
        <div className="min-w-0 flex-1">
          {/* Tab bar */}
          <div className="mb-4 flex gap-2">
            {MAIN_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setMainTab(t.key)}
                className={`microlabel rounded-full border px-4 py-1.5 transition ${
                  mainTab === t.key
                    ? "border-gold text-gold"
                    : "border-line text-muted hover:border-gold/40 hover:text-gold/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="gilt-frame rounded-2xl bg-surface/60 p-5">
            {renderMainTab(mainTab)}
          </div>
        </div>
        <div className="w-72 flex-shrink-0">
          <div className="flex flex-col gap-6">{evidencePanel}</div>
        </div>
      </div>

      {/* Mobile: tabs including evidence */}
      <div className="mt-6 lg:hidden">
        <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
          {([...MAIN_TABS, { key: "evidence" as const, label: "Evidence" }]).map((t) => (
            <button
              key={t.key}
              onClick={() => setMobileTab(t.key as MobileTab)}
              className={`microlabel flex-shrink-0 rounded-full border px-3 py-2 ${
                mobileTab === t.key
                  ? "border-gold text-gold"
                  : "border-line text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {mobileTab === "evidence" ? (
          <div className="flex flex-col gap-6">{evidencePanel}</div>
        ) : (
          <div className="gilt-frame rounded-2xl bg-surface/60 p-4">
            {renderMainTab(mobileTab as MainTab)}
          </div>
        )}
      </div>

      <AchievementToast queue={toasts} />
    </div>
  );
}
