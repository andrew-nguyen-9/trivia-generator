"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { project, unproject, type LatLng } from "@/lib/geo";

// world-atlas (~50-80 KB) is loaded lazily — only fetched when WorldMap first
// renders, so the Google Map path (which never mounts WorldMap) skips it entirely.
let LAND_PATH_CACHE = "";

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
      {t && (
        <>
          <circle cx={t.x} cy={t.y} r="3" fill="none" stroke={accent} strokeWidth="1" />
          <circle cx={t.x} cy={t.y} r="1.2" fill={accent} />
        </>
      )}
    </svg>
  );
}
