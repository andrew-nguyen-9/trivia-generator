"use client";

import { useMemo } from "react";
import {
  CATEGORIES,
  CATEGORY_HEX,
  CATEGORY_LABEL,
  type Category,
} from "@/lib/types";
import {
  ACHIEVEMENTS,
  ROOMS,
  dayStreak,
  levelFromXp,
  useProfile,
  xpIntoLevel,
  xpPerLevel,
  type Room,
} from "@/lib/profile";

const ROOM_LABEL: Record<Room, string> = {
  board: "Codex",
  clock: "Chronos",
  wedges: "Fractures",
  streak: "Ignite",
  map: "Atlas Obscura",
  daily: "The Gauntlet",
  jukebox: "The Jukebox",
  gallery: "The Gallery",
  blitz: "The Blitz",
  connections: "The Connections",
  mystery: "Sanctum Mysterii",
};

/** last 12 weeks of play-activity, GitHub-style. */
function Heatmap({ days }: { days: string[] }) {
  const set = useMemo(() => new Set(days), [days]);
  const cells = useMemo(() => {
    const out: { iso: string; on: boolean }[] = [];
    const d = new Date();
    for (let i = 83; i >= 0; i--) {
      const day = new Date(d);
      day.setDate(d.getDate() - i);
      const iso = day.toISOString().slice(0, 10);
      out.push({ iso, on: set.has(iso) });
    }
    return out;
  }, [set]);

  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1">
      {cells.map((c) => (
        <span
          key={c.iso}
          title={c.iso}
          className="h-3 w-3 rounded-sm"
          style={{ background: c.on ? "#b07aff" : "#1c1c2e" }}
        />
      ))}
    </div>
  );
}

export default function ProfileDashboard() {
  const { profile } = useProfile();
  const level = levelFromXp(profile.xp);
  const into = xpIntoLevel(profile.xp);
  const streak = dayStreak(profile.days);
  const totalPlays = Object.values(profile.plays).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <div>
      <h1 className="display text-5xl sm:text-6xl">Your Card</h1>

      {/* level + xp */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="microlabel text-wildcard">level</p>
            <p className="display tabular text-6xl text-wildcard">{level}</p>
          </div>
          <div className="text-right">
            <p className="microlabel">total xp</p>
            <p className="tabular text-2xl font-black">{profile.xp.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-wildcard transition-[width]"
            style={{ width: `${(into / xpPerLevel) * 100}%` }}
          />
        </div>
        <p className="microlabel mt-2 text-muted">
          {into} / {xpPerLevel} xp to level {level + 1}
        </p>
      </div>

      {/* quick stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="games played" value={totalPlays} />
        <Stat label="day streak" value={`${streak}🔥`} />
        <Stat label="badges" value={`${profile.achievements.length}/${ACHIEVEMENTS.length}`} />
      </div>

      {/* activity heatmap */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="microlabel mb-4">activity — last 12 weeks</p>
        <Heatmap days={profile.days} />
      </div>

      {/* per-category accuracy */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="microlabel mb-4">accuracy by category</p>
        <div className="space-y-3">
          {CATEGORIES.map((cat: Category) => {
            const c = profile.cat[cat];
            const pct = c && c.total ? Math.round((c.correct / c.total) * 100) : 0;
            return (
              <div key={cat}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: CATEGORY_HEX[cat] }}>{CATEGORY_LABEL[cat]}</span>
                  <span className="tabular text-muted">
                    {c ? `${pct}% · ${c.correct}/${c.total}` : "—"}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${pct}%`, background: CATEGORY_HEX[cat] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* best scores */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="microlabel mb-4">personal bests</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ROOMS.map((room) => (
            <div key={room} className="rounded-xl border border-line p-3">
              <p className="microlabel text-muted">{ROOM_LABEL[room]}</p>
              <p className="tabular mt-1 text-xl font-black">
                {(profile.best[room] ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* achievements */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="microlabel mb-4">achievements</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const got = profile.achievements.includes(a.id);
            return (
              <div
                key={a.id}
                className={`rounded-xl border p-3 transition ${
                  got ? "border-wildcard bg-wildcard/10" : "border-line opacity-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{got ? a.icon : "🔒"}</span>
                  <span className="text-sm font-black">{a.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 text-center">
      <p className="microlabel">{label}</p>
      <p className="tabular mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}
