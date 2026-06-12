"use client";

import { useMemo, useRef } from "react";
import type { Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import landTopo from "world-atlas/land-110m.json";
import { project, unproject, type LatLng } from "@/lib/geo";

// Natural Earth land (110m) via the world-atlas npm package — fully offline,
// no tile servers (house rule: playable from clone).
function ringsToPath(coords: Position[][]): string {
  let d = "";
  for (const ring of coords) {
    ring.forEach(([lng, lat], i) => {
      const { x, y } = project({ lat, lng });
      d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    d += "Z";
  }
  return d;
}

let LAND_PATH = "";
function landPath(): string {
  if (LAND_PATH) return LAND_PATH;
  const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land);
  LAND_PATH = land.features
    .map((f) =>
      f.geometry.type === "Polygon"
        ? ringsToPath(f.geometry.coordinates)
        : f.geometry.type === "MultiPolygon"
          ? f.geometry.coordinates.map(ringsToPath).join("")
          : "",
    )
    .join("");
  return LAND_PATH;
}

export default function WorldMap({
  guess,
  truth,
  onPick,
  disabled,
  accent,
}: {
  guess: LatLng | null;
  truth: LatLng | null; // non-null ⇒ revealed
  onPick: (p: LatLng) => void;
  disabled?: boolean;
  accent: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const d = useMemo(landPath, []);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (disabled || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 360;
    const y = ((e.clientY - rect.top) / rect.height) * 180;
    onPick(unproject(x, y));
  }

  const g = guess ? project(guess) : null;
  const t = truth ? project(truth) : null;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 360 180"
      onClick={handleClick}
      role="img"
      aria-label="world map — click to place your guess"
      className={`w-full rounded-2xl border border-line bg-surface ${disabled ? "" : "cursor-crosshair"}`}
    >
      <path d={d} fill="#1c1c2e" stroke="#26263a" strokeWidth="0.3" />
      {g && t && (
        <line
          x1={g.x}
          y1={g.y}
          x2={t.x}
          y2={t.y}
          stroke={accent}
          strokeWidth="0.7"
          strokeDasharray="2 2"
        />
      )}
      {g && (
        <>
          <circle cx={g.x} cy={g.y} r="2.4" fill="none" stroke="#f5f3ee" strokeWidth="0.8" />
          <circle cx={g.x} cy={g.y} r="0.9" fill="#f5f3ee" />
        </>
      )}
      {t && (
        <>
          <circle cx={t.x} cy={t.y} r="3" fill="none" stroke={accent} strokeWidth="1" />
          <circle cx={t.x} cy={t.y} r="1.2" fill={accent} />
        </>
      )}
    </svg>
  );
}
