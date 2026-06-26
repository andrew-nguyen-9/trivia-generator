"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CATEGORIES,
  CATEGORY_GLYPH,
  CATEGORY_HEX,
  CATEGORY_LABEL,
  type Category,
} from "@/lib/types";
import { weakestCategory } from "@/lib/weakspot";
import {
  COLLECTION,
  collection,
  collectionProgress,
  monthGrid,
  nextToCollect,
} from "@/lib/collection";
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

// room display names — single source is the collection catalog
const ROOM_LABEL = Object.fromEntries(
  COLLECTION.map((c) => [c.room, c.label]),
) as Record<Room, string>;

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

/** This month's completed-days grid — Sun-first, today ringed. */
function Calendar({ weeks }: { weeks: ReturnType<typeof monthGrid> }) {
  const dow = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {dow.map((d, i) => (
        <span key={i} className="microlabel text-center text-muted">
          {d}
        </span>
      ))}
      {weeks.flat().map((c) => (
        <div
          key={c.iso}
          title={c.inMonth ? c.iso : undefined}
          className={`flex aspect-square items-center justify-center rounded-md text-[11px] tabular ${
            c.today ? "ring-2 ring-wildcard" : ""
          } ${c.inMonth ? (c.played ? "font-black" : "text-muted") : "opacity-0"}`}
          style={{
            background: c.inMonth ? (c.played ? "#b07aff" : "#1c1c2e") : "transparent",
            color: c.inMonth && c.played ? "#161122" : undefined,
          }}
        >
          {c.inMonth ? c.day : ""}
        </div>
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
  const weak = weakestCategory(profile.cat);
  const cards = collection(profile);
  const prog = collectionProgress(profile);
  const next = nextToCollect(profile);
  const weeks = monthGrid(profile.days);
  const monthName = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

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

      {/* the return loop — a deck to complete + this month's calendar */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-end justify-between">
          <p className="microlabel">the deck</p>
          <p className="microlabel tabular text-wildcard">
            {prog.have}/{prog.total} collected
          </p>
        </div>

        {/* this month */}
        <div className="mt-4 rounded-xl border border-line p-4">
          <p className="microlabel mb-3 text-muted">{monthName}</p>
          <Calendar weeks={weeks} />
        </div>

        {/* the cards — collected vs still locked */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((c) =>
            c.owned ? (
              <Link
                key={c.room}
                href={c.href}
                className="rounded-xl border p-3 transition hover:bg-bg"
                style={{ borderColor: CATEGORY_HEX[c.accent] }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black">{c.label}</span>
                  <span className="text-lg" style={{ color: CATEGORY_HEX[c.accent] }}>
                    {CATEGORY_GLYPH[c.accent]}
                  </span>
                </div>
                <p className="microlabel mt-1 text-muted">
                  {c.plays} play{c.plays === 1 ? "" : "s"}
                  {c.best ? ` · best ${c.best.toLocaleString()}` : ""}
                </p>
              </Link>
            ) : (
              <Link
                key={c.room}
                href={c.href}
                className="rounded-xl border border-line p-3 opacity-50 transition hover:opacity-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-muted">{c.label}</span>
                  <span className="text-lg text-muted">🔒</span>
                </div>
                <p className="microlabel mt-1 text-muted">collect →</p>
              </Link>
            ),
          )}
        </div>

        {/* come-back nudge: the next card to add */}
        {next ? (
          <Link
            href={next.href}
            className="mt-4 flex items-center justify-between rounded-xl border p-4 transition hover:bg-bg"
            style={{ borderColor: CATEGORY_HEX[next.accent] }}
          >
            <span>
              <span className="microlabel" style={{ color: CATEGORY_HEX[next.accent] }}>
                next card
              </span>
              <span className="ml-2 text-sm font-black">{next.label}</span>
            </span>
            <span style={{ color: CATEGORY_HEX[next.accent] }}>
              {CATEGORY_GLYPH[next.accent]} →
            </span>
          </Link>
        ) : (
          <p className="mt-4 text-center text-sm font-black text-wildcard">
            Full deck — every room collected ♦♥♣♠
          </p>
        )}
      </div>

      {/* activity heatmap */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="microlabel mb-4">activity — last 12 weeks</p>
        <Heatmap days={profile.days} />
      </div>

      {/* weak-spot practice — route the player to drill their worst category */}
      {weak && (
        <Link
          href={weak.href}
          className="mt-6 flex items-center justify-between rounded-2xl border p-6 transition hover:bg-surface"
          style={{ borderColor: CATEGORY_HEX[weak.category] }}
        >
          <div>
            <p className="microlabel" style={{ color: CATEGORY_HEX[weak.category] }}>
              your weak spot
            </p>
            <p className="mt-1 text-xl font-black">
              {weak.label} — {Math.round(weak.accuracy * 100)}%
            </p>
            <p className="mt-1 text-xs text-muted">
              drill it in {weak.room}
            </p>
          </div>
          <span className="text-2xl" style={{ color: CATEGORY_HEX[weak.category] }}>
            →
          </span>
        </Link>
      )}

      {/* per-category accuracy */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <p className="microlabel mb-4">accuracy by category</p>
        <div className="space-y-3">
          {CATEGORIES.map((cat: Category) => {
            const c = profile.cat[cat];
            const pct = c && c.total ? Math.round((c.correct / c.total) * 100) : 0;
            const isWeak = weak?.category === cat;
            return (
              <div key={cat}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: CATEGORY_HEX[cat] }}>
                    {CATEGORY_LABEL[cat]}
                    {isWeak && <span className="ml-2 text-muted">· weak spot</span>}
                  </span>
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
