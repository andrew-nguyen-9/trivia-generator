"use client";

import { useMemo, useState } from "react";
import { HOURS, deductionMatrix, type MysteryCase } from "@/lib/mystery";
import type { MysteryContext } from "@/lib/mysteryTypes";
import MysteryStatusPill, { type SuspectTag } from "./MysteryStatusPill";
import { TooltipWrapper } from "./MysteryCharacterTooltip";

function dotColor(
  suspectId: string,
  hourIndex: number,
  mystery: MysteryCase,
  context: MysteryContext
): "gold" | "green" | "red" {
  if (!context.loaded) return "red";
  const charCtx = context.byCharacter[suspectId];
  if (!charCtx) return "red";
  const hourLabel = HOURS[hourIndex];

  const crossConfirmed = mystery.suspects.some((other) => {
    if (other.id === suspectId) return false;
    const otherCtx = context.byCharacter[other.id];
    return otherCtx?.witnesses.some(
      (w) =>
        w.aboutCharacter === suspectId &&
        w.statementType === "true" &&
        w.hour === hourLabel
    );
  });
  if (crossConfirmed) return "green";

  const selfCorroborated = charCtx.witnesses.some(
    (w) => w.statementType === "true" && w.hour === hourLabel
  );
  return selfCorroborated ? "gold" : "red";
}

const DOT_CLASS: Record<"gold" | "green" | "red", string> = {
  gold: "bg-amber-400",
  green: "bg-green-600",
  red: "bg-red-800",
};

export default function MysteryAlibiTracker({
  mystery,
  context,
  cluesRevealed,
  tags,
  onCycleTag,
  onAutoMark,
  autoMarkUsed,
  notesMap,
  onNoteChange,
}: {
  mystery: MysteryCase;
  context: MysteryContext;
  cluesRevealed: number;
  tags: Record<string, SuspectTag>;
  onCycleTag: (id: string) => void;
  onAutoMark: () => void;
  autoMarkUsed: boolean;
  notesMap: Record<string, string>;
  onNoteChange: (key: string, val: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const matrix = useMemo(
    () => deductionMatrix(mystery, cluesRevealed),
    [mystery, cluesRevealed]
  );

  const confirmedHour = useMemo(() => {
    for (let h = 0; h < HOURS.length; h++) {
      if (matrix.some((row) => row[h] === "confirmed")) return h;
    }
    return null;
  }, [matrix]);

  const cleared = Object.values(tags).filter((t) => t === "cleared").length;
  const potential = Object.values(tags).filter((t) => t === "potential").length;
  const prime = Object.values(tags).filter((t) => t === "prime").length;

  const unverified = useMemo(() => {
    let count = 0;
    for (const s of mystery.suspects) {
      for (let h = 0; h < HOURS.length; h++) {
        if (dotColor(s.id, h, mystery, context) === "red") count++;
      }
    }
    return count;
  }, [mystery, context]);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={onAutoMark}
          disabled={autoMarkUsed}
          className={`microlabel flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition ${
            autoMarkUsed
              ? "cursor-default border-line text-muted opacity-50"
              : "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
          }`}
        >
          ⚡ Auto-mark{autoMarkUsed ? " (used −150pts)" : ""}
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="microlabel px-3 py-2 text-left text-muted">
                Suspect
              </th>
              {HOURS.map((hour, h) => (
                <th
                  key={hour}
                  className={`microlabel px-3 py-2 text-center ${
                    confirmedHour === h
                      ? "text-ember underline decoration-ember/60 underline-offset-4"
                      : "text-muted"
                  }`}
                >
                  {hour}
                </th>
              ))}
              <th className="microlabel px-3 py-2 text-center text-muted">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {mystery.suspects.map((suspect) => (
              <tr key={suspect.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <TooltipWrapper
                    character={suspect}
                    mystery={mystery}
                    context={context}
                  >
                    <div className="flex cursor-default items-center gap-2">
                      <span className="text-xl">{suspect.emoji}</span>
                      <span className="display text-sm text-ink">
                        {suspect.id
                          .split("-")
                          .map((p) => p[0].toUpperCase() + p.slice(1))
                          .join(" ")}
                      </span>
                    </div>
                  </TooltipWrapper>
                </td>
                {HOURS.map((hour, h) => {
                  const room = mystery.dossiers[suspect.id].claimed[h];
                  const dot = dotColor(suspect.id, h, mystery, context);
                  const alibiEntry = context.loaded
                    ? context.byCharacter[suspect.id]?.alibis.find(
                        (a) => a.roomId === room && a.hour === hour
                      )
                    : undefined;
                  const noteKey = `${suspect.id}-${hour}`;
                  const note = notesMap[noteKey] ?? "";
                  const alibiText = note || alibiEntry?.alibi || null;
                  return (
                    <td key={hour} className="px-2 py-2 align-top">
                      <div className="flex min-w-[100px] flex-col gap-1">
                        <div className="flex items-start gap-1">
                          <span
                            className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${DOT_CLASS[dot]}`}
                          />
                          <span className="rounded bg-surface/80 px-1.5 py-0.5 text-xs italic text-muted">
                            {room.replace(/^the /, "")}
                          </span>
                        </div>
                        <div className="flex items-start gap-1">
                          <span
                            className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${DOT_CLASS[dot]}`}
                          />
                          {editing === noteKey ? (
                            <input
                              autoFocus
                              className="w-full rounded bg-surface/80 px-1.5 py-0.5 text-xs text-ink outline-none ring-1 ring-amber-400/40"
                              value={note}
                              onChange={(e) => onNoteChange(noteKey, e.target.value)}
                              onBlur={() => setEditing(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") setEditing(null);
                              }}
                              placeholder={alibiEntry?.alibi ?? "add note…"}
                            />
                          ) : (
                            <span
                              className={`cursor-pointer rounded px-1.5 py-0.5 text-xs ${
                                alibiText
                                  ? "bg-surface/40 text-ink/70"
                                  : "bg-surface/20 italic text-muted/50 hover:bg-surface/40"
                              }`}
                              onClick={() => setEditing(noteKey)}
                              title="Click to annotate"
                            >
                              {alibiText ?? "???"}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center">
                  <MysteryStatusPill
                    tag={tags[suspect.id]}
                    onCycle={() => onCycleTag(suspect.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <td colSpan={HOURS.length + 2} className="px-3 py-2">
                <p className="microlabel text-muted">
                  CLEARED: {cleared} · POTENTIAL: {potential} · PRIME: {prime}{" "}
                  · UNVERIFIED ALIBIS: {unverified}
                </p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
