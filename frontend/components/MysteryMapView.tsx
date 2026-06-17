"use client";

import { useMemo, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { HOURS, type MysteryCase } from "@/lib/mystery";
import type { MysteryContext } from "@/lib/mysteryTypes";
import { TooltipWrapper } from "./MysteryCharacterTooltip";

// Room center positions as % of the container (match mansion-map.jpg layout)
// These percentages target the visual center of each room in the image.
// Adjust after the image is in place.
const ROOM_CENTERS: Record<string, { cx: number; cy: number }> = {
  "the Observatory":    { cx: 50,   cy: 19 },
  "the Smoking Lounge": { cx: 13,   cy: 40 },
  "the Conservatory":   { cx: 86,   cy: 37 },
  "the Grand Ballroom": { cx: 50,   cy: 57 },
  "the Velvet Library": { cx: 14,   cy: 70 },
  "the Wine Cellar":    { cx: 84,   cy: 70 },
};

export const DOORS: [string, string][] = [
  ["the Observatory",    "the Grand Ballroom"],
  ["the Smoking Lounge", "the Grand Ballroom"],
  ["the Conservatory",   "the Grand Ballroom"],
  ["the Velvet Library", "the Grand Ballroom"],
  ["the Wine Cellar",    "the Grand Ballroom"],
  ["the Conservatory",   "the Wine Cellar"],
];

function polygonPositions(
  n: number,
  cx: number,
  cy: number,
  r: number
): [number, number][] {
  if (n === 1) return [[cx, cy]];
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [
      number,
      number
    ];
  });
}

export default function MysteryMapView({
  mystery,
  context,
  verdictSubmitted,
}: {
  mystery: MysteryCase;
  context: MysteryContext;
  verdictSubmitted?: boolean;
}) {
  const [selectedHour, setSelectedHour] = useState(0);

  // Group suspects by room for the selected hour
  const roomGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const s of mystery.suspects) {
      const room = mystery.dossiers[s.id].claimed[selectedHour];
      if (!groups[room]) groups[room] = [];
      groups[room].push(s.id);
    }
    return groups;
  }, [mystery, selectedHour]);

  // Compute final position for each suspect
  const positions = useMemo(() => {
    const result: Record<string, { x: number; y: number }> = {};
    for (const [room, ids] of Object.entries(roomGroups)) {
      const center = ROOM_CENTERS[room] ?? { cx: 50, cy: 50 };
      const spread = ids.length <= 1 ? 0 : ids.length <= 3 ? 3.5 : 5;
      const pts = polygonPositions(ids.length, center.cx, center.cy, spread);
      ids.forEach((id, i) => {
        result[id] = { x: pts[i][0], y: pts[i][1] };
      });
    }
    return result;
  }, [roomGroups]);

  return (
    <div className="w-full space-y-4">
      {/* Map container */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-bg/60">
        <img
          src="/mansion-map.jpg"
          alt="Mansion floor plan"
          className="w-full"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Fallback placeholder shown when image is absent */}
        <div className="absolute inset-0 -z-10 bg-surface/80" />

        <LayoutGroup>
          {mystery.suspects.map((suspect) => {
            const pos = positions[suspect.id];
            if (!pos) return null;
            const isCulprit = mystery.culprits.includes(suspect.id);
            const glowing =
              verdictSubmitted && isCulprit && selectedHour === mystery.hourIndex;
            return (
              <motion.div
                key={suspect.id}
                layoutId={`mystery-map-char-${suspect.id}`}
                style={{
                  position: "absolute",
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                  filter: glowing
                    ? "drop-shadow(0 0 10px rgba(220,80,60,0.9))"
                    : "drop-shadow(0 0 7px rgba(255, 248, 220, 0.85))",
                }}
                transition={{ type: "spring", stiffness: 180, damping: 28 }}
              >
                <TooltipWrapper
                  character={suspect}
                  mystery={mystery}
                  context={context}
                >
                  <div
                    className={`cursor-pointer select-none text-2xl ${
                      glowing ? "animate-pulse" : ""
                    }`}
                  >
                    {suspect.emoji}
                  </div>
                </TooltipWrapper>
              </motion.div>
            );
          })}
        </LayoutGroup>
      </div>

      {/* Timeline scrubber */}
      <div className="px-2">
        <div className="mb-2 flex justify-between">
          {HOURS.map((hour, h) => (
            <span
              key={hour}
              className={`microlabel cursor-pointer ${
                selectedHour === h ? "text-gold" : "text-muted"
              }`}
              onClick={() => setSelectedHour(h)}
            >
              {hour}
            </span>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={HOURS.length - 1}
          value={selectedHour}
          onChange={(e) => setSelectedHour(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-amber-400"
        />
      </div>
    </div>
  );
}
