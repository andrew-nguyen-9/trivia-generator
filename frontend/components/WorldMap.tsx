"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { project, unproject, type LatLng } from "@/lib/geo";

// world-atlas (~50-80 KB) is loaded lazily — only fetched when WorldMap first
// renders, so the Google Map path (which never mounts WorldMap) skips it entirely.
let LAND_PATH_CACHE = "";

// Equirectangular has no wrap handling, so a ring that crosses the antimeridian
// (e.g. Antarctica, Chukotka, Fiji) has consecutive vertices whose longitude
// jumps ~+180 → ~-180. Drawing an `L` between them sweeps a horizontal line
// straight across the map — the "stray lines" bug. We break the subpath (start a
// fresh `M`) whenever a step jumps more than half the world in x.
function ringsToPath(coords: Position[][]): string {
  let d = "";
  for (const ring of coords) {
    let prevX: number | null = null;
    ring.forEach(([lng, lat]) => {
      const { x, y } = project({ lat, lng });
      const jumped = prevX !== null && Math.abs(x - prevX) > 180;
      d += `${prevX === null || jumped ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      prevX = x;
    });
    d += "Z";
  }
  return d;
}

export default function WorldMap({
  guess,
  truth,
  onPick,
  disabled,
  accent,
}: {
  guess: LatLng | null;
  truth: LatLng | null;
  onPick: (p: LatLng) => void;
  disabled?: boolean;
  accent: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [landPath, setLandPath] = useState(LAND_PATH_CACHE);

  useEffect(() => {
    if (LAND_PATH_CACHE) {
      setLandPath(LAND_PATH_CACHE);
      return;
    }
    import("world-atlas/land-110m.json").then((mod) => {
      const topo = mod.default as unknown as Topology<{ land: GeometryCollection }>;
      const land = feature(topo, topo.objects.land);
      LAND_PATH_CACHE = land.features
        .map((f) =>
          f.geometry.type === "Polygon"
            ? ringsToPath(f.geometry.coordinates)
            : f.geometry.type === "MultiPolygon"
              ? f.geometry.coordinates.map(ringsToPath).join("")
              : "",
        )
        .join("");
      setLandPath(LAND_PATH_CACHE);
    });
  }, []);

  // keyboard crosshair (a11y 2.14): focus the map, arrow-keys move a reticle,
  // Enter/Space drops the pin. Step is 5° (Shift = 1° fine adjust).
  const [kb, setKb] = useState<LatLng>({ lat: 20, lng: 0 });
  const [focused, setFocused] = useState(false);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (disabled || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 360;
    const y = ((e.clientY - rect.top) / rect.height) * 180;
    onPick(unproject(x, y));
  }

  function handleKey(e: React.KeyboardEvent<SVGSVGElement>) {
    if (disabled) return;
    const step = e.shiftKey ? 1 : 5;
    let { lat, lng } = kb;
    if (e.key === "ArrowUp") lat = Math.min(90, lat + step);
    else if (e.key === "ArrowDown") lat = Math.max(-90, lat - step);
    else if (e.key === "ArrowLeft") lng = Math.max(-180, lng - step);
    else if (e.key === "ArrowRight") lng = Math.min(180, lng + step);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(kb);
      return;
    } else return;
    e.preventDefault();
    setKb({ lat, lng });
  }

  const g = guess ? project(guess) : null;
  const t = truth ? project(truth) : null;
  const k = focused && !disabled ? project(kb) : null;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 360 180"
      onClick={handleClick}
      onKeyDown={handleKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      tabIndex={disabled ? -1 : 0}
      role="application"
      aria-label="World map. Click to place your guess, or focus and use arrow keys to move the reticle and Enter to drop the pin."
      className={`w-full rounded-2xl border border-line bg-surface ${disabled ? "" : "cursor-crosshair"}`}
    >
      {landPath && (
        <path d={landPath} fill="#0d0d18" stroke="#1a1a2e" strokeWidth="0.3" />
      )}
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
          <circle cx={g.x} cy={g.y} r="2.4" fill="none" stroke="#f0ede6" strokeWidth="0.8" />
          <circle cx={g.x} cy={g.y} r="0.9" fill="#f0ede6" />
        </>
      )}
      {k && (
        /* keyboard reticle (only while the map is focused) */
        <g stroke={accent} strokeWidth="0.6" opacity="0.9">
          <line x1={k.x - 4} y1={k.y} x2={k.x + 4} y2={k.y} />
          <line x1={k.x} y1={k.y - 4} x2={k.x} y2={k.y + 4} />
          <circle cx={k.x} cy={k.y} r="2" fill="none" />
        </g>
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
