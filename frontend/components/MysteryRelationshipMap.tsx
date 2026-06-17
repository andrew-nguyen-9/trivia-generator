"use client";

import { useState } from "react";
import type { MysteryCase } from "@/lib/mystery";
import { pretty } from "@/lib/mystery";
import type { MysteryContext } from "@/lib/mysteryTypes";
import { TooltipWrapper } from "./MysteryCharacterTooltip";

const SVG_SIZE = 500;
const CENTER = SVG_SIZE / 2;
const RADIUS = 185;
const NODE_R = 22;

function relColor(kind: string): string {
  if (kind === "rival" || kind === "secret-keeper") return "rgba(110,31,43,0.6)";
  if (kind === "old flame") return "rgba(42,95,90,0.6)";
  return "rgba(201,162,74,0.6)";
}

export default function MysteryRelationshipMap({
  mystery,
  context,
}: {
  mystery: MysteryCase;
  context: MysteryContext;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [compared, setCompared] = useState<string | null>(null);
  const suspects = mystery.suspects;

  // Circumference positions (x, y in SVG coordinates)
  const nodePos = suspects.map((s, i) => {
    const angle = (2 * Math.PI * i) / suspects.length - Math.PI / 2;
    return {
      id: s.id,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    };
  });
  const posMap = Object.fromEntries(nodePos.map((p) => [p.id, p]));

  // Relationship kind from victim to suspect (via ringleader edge or dossier)
  function victimRelKind(suspectId: string): string {
    if (mystery.culprits[0] === suspectId) return "rival";
    const dossier = mystery.dossiers[suspectId];
    const rel = dossier?.relationships.find((r) => r.to === mystery.victim.id);
    return rel?.kind ?? "business partner";
  }

  function isActive(id: string): boolean {
    if (!selected && !compared) return true;
    return id === selected || id === compared;
  }

  function edgeActive(fromId: string, toId: string): boolean {
    if (!selected) return false;
    if (compared) {
      return (fromId === selected && toId === compared) ||
             (fromId === compared && toId === selected);
    }
    return selected === fromId || selected === toId;
  }

  return (
    <div
      className="relative w-full"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelected(null);
          setCompared(null);
        }
      }}
    >
      {/* SVG layer — lines only */}
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full"
        style={{ maxHeight: 500 }}
      >
        <defs>
          <filter id="rel-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Between-suspect relationship lines */}
        {suspects.flatMap((s) =>
          mystery.dossiers[s.id].relationships
            .filter((r) => posMap[r.to])
            .map((rel) => {
              const from = posMap[s.id];
              const to = posMap[rel.to];
              const active = edgeActive(s.id, rel.to);
              return (
                <line
                  key={`${s.id}→${rel.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={relColor(rel.kind)}
                  strokeWidth={active ? 2 : 1}
                  opacity={selected ? (active ? 0.75 : 0.07) : 0.15}
                  filter={active ? "url(#rel-glow)" : undefined}
                />
              );
            })
        )}

        {/* Victim → suspect spokes */}
        {nodePos.map((pos) => {
          const kind = victimRelKind(pos.id);
          const active = !selected || selected === pos.id;
          return (
            <line
              key={`victim→${pos.id}`}
              x1={CENTER}
              y1={CENTER}
              x2={pos.x}
              y2={pos.y}
              stroke={relColor(kind)}
              strokeWidth={active ? 2.5 : 1}
              opacity={selected ? (selected === pos.id ? 0.9 : 0.08) : 0.5}
              filter={selected === pos.id ? "url(#rel-glow)" : undefined}
            />
          );
        })}

        {/* Victim circle at center */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={NODE_R + 6}
          fill="rgba(20,16,12,0.9)"
          stroke="rgba(201,162,74,0.8)"
          strokeWidth={2}
        />

        {/* Suspect ring circles */}
        {nodePos.map((pos) => (
          <circle
            key={`circle-${pos.id}`}
            cx={pos.x}
            cy={pos.y}
            r={NODE_R}
            fill="rgba(20,16,12,0.9)"
            stroke={isActive(pos.id) ? "rgba(201,162,74,0.4)" : "rgba(80,70,60,0.2)"}
            strokeWidth={1.5}
            style={{ cursor: "pointer" }}
            onClick={() => {
              if (!selected || selected === pos.id) {
                setSelected(selected === pos.id ? null : pos.id);
                setCompared(null);
              } else {
                setCompared(compared === pos.id ? null : pos.id);
              }
            }}
          />
        ))}
      </svg>

      {/* Emoji overlays (absolute-positioned divs so TooltipWrapper works) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ aspectRatio: "1 / 1" }}
      >
        {/* Victim at center */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 select-none text-2xl"
          style={{ left: "50%", top: "50%" }}
        >
          {mystery.victim.emoji}
        </div>

        {/* Suspects on circumference */}
        {nodePos.map((pos) => {
          const suspect = suspects.find((s) => s.id === pos.id)!;
          const xPct = (pos.x / SVG_SIZE) * 100;
          const yPct = (pos.y / SVG_SIZE) * 100;
          return (
            <div
              key={`emoji-${pos.id}`}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                opacity: isActive(pos.id) ? 1 : 0.35,
                transition: "opacity 0.15s",
              }}
              onClick={() => {
                if (!selected || selected === pos.id) {
                  setSelected(selected === pos.id ? null : pos.id);
                  setCompared(null);
                } else {
                  setCompared(compared === pos.id ? null : pos.id);
                }
              }}
            >
              <TooltipWrapper
                character={suspect}
                mystery={mystery}
                context={context}
              >
                <span className="cursor-pointer select-none text-xl">
                  {suspect.emoji}
                </span>
              </TooltipWrapper>
            </div>
          );
        })}
      </div>

      {/* Compare label pill between the two characters */}
      {selected && compared && (() => {
        const fromPos = nodePos.find(p => p.id === selected)!;
        const toPos = nodePos.find(p => p.id === compared)!;
        const midXPct = ((fromPos.x + toPos.x) / 2 / SVG_SIZE) * 100;
        const midYPct = ((fromPos.y + toPos.y) / 2 / SVG_SIZE) * 100;
        const sharedRel = mystery.dossiers[selected]?.relationships.find(r => r.to === compared)
          ?? mystery.dossiers[compared]?.relationships.find(r => r.to === selected);
        return (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/40 bg-surface/90 px-2 py-0.5"
            style={{ left: `${midXPct}%`, top: `${midYPct}%` }}
          >
            <p className="microlabel text-gold">{sharedRel?.kind ?? "no direct tie"}</p>
          </div>
        );
      })()}

      {/* Selected character label */}
      {selected && (
        <div className="mt-2 text-center">
          <p className="microlabel text-gold">{pretty(selected)}{compared ? ` ↔ ${pretty(compared)}` : ""}</p>
          <p className="text-xs text-muted">
            {compared
              ? (mystery.dossiers[selected]?.relationships.find(r => r.to === compared)?.kind ?? "no direct tie")
              : `${victimRelKind(selected)} to victim`}
          </p>
        </div>
      )}
    </div>
  );
}
