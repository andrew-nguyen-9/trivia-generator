// Player progression — aggregated entirely in localStorage so the frontend stays
// read-only against the DB (house rule). Every room calls recordResult() when a
// run ends; XP, levels, per-category accuracy, a daily-play streak, and unlockable
// achievements all derive from the accumulated history.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category } from "./types";

const KEY = "parlor:profile";
const XP_PER_LEVEL = 1000;
const MAX_HISTORY = 200;

export const ROOMS = [
  "board",
  "clock",
  "wedges",
  "streak",
  "map",
  "daily",
  "jukebox",
  "gallery",
  "blitz",
  "connections",
] as const;
export type Room = (typeof ROOMS)[number];

export interface GameResult {
  room: Room;
  score: number;
  xp?: number; // defaults to clamp(score)
  correct?: number;
  total?: number;
  perCategory?: Partial<Record<Category, { correct: number; total: number }>>;
}

export interface Profile {
  xp: number;
  plays: Partial<Record<Room, number>>;
  best: Partial<Record<Room, number>>;
  cat: Partial<Record<Category, { correct: number; total: number }>>;
  days: string[]; // ISO dates the player has played (dedup, sorted)
  achievements: string[];
  history: { room: Room; score: number; ts: number }[];
}

const EMPTY: Profile = {
  xp: 0,
  plays: {},
  best: {},
  cat: {},
  days: [],
  achievements: [],
  history: [],
};

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  test: (p: Profile) => boolean;
}

const totalPlays = (p: Profile) =>
  Object.values(p.plays).reduce((s, n) => s + (n ?? 0), 0);

/** Longest run of consecutive days ending today (or yesterday). */
export function dayStreak(days: string[]): number {
  if (days.length === 0) return 0;
  const set = new Set(days);
  const d = new Date();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  // allow the streak to be "alive" if they played today or yesterday
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
  if (!set.has(iso(d))) return 0;
  let streak = 0;
  while (set.has(iso(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_steps", name: "First Steps", desc: "Play your first game", icon: "🎟️", test: (p) => totalPlays(p) >= 1 },
  { id: "regular", name: "Regular", desc: "Play 10 games", icon: "🪑", test: (p) => totalPlays(p) >= 10 },
  { id: "devotee", name: "House Devotee", desc: "Play 50 games", icon: "🎩", test: (p) => totalPlays(p) >= 50 },
  { id: "high_roller", name: "High Roller", desc: "Score $5,000+ on The Board", icon: "💰", test: (p) => (p.best.board ?? 0) >= 5000 },
  { id: "sharpshooter", name: "Sharpshooter", desc: "Score 400+ on The Clock", icon: "🎯", test: (p) => (p.best.clock ?? 0) >= 400 },
  { id: "globetrotter", name: "Globetrotter", desc: "Score 300+ on The Map", icon: "🧭", test: (p) => (p.best.map ?? 0) >= 300 },
  { id: "blitzed", name: "Blitzed", desc: "Land 20+ in a Blitz round", icon: "⚡", test: (p) => (p.best.blitz ?? 0) >= 20 },
  { id: "perfect_ear", name: "Perfect Ear", desc: "Nail 5 tunes in The Jukebox", icon: "🎧", test: (p) => (p.best.jukebox ?? 0) >= 5 },
  { id: "connected", name: "Connected", desc: "Solve a Connections grid", icon: "🧩", test: (p) => (p.best.connections ?? 0) >= 4 },
  { id: "week_streak", name: "Seven-Day Habit", desc: "Play 7 days in a row", icon: "🔥", test: (p) => dayStreak(p.days) >= 7 },
  {
    id: "polymath",
    name: "Polymath",
    desc: "60%+ accuracy in every category",
    icon: "🦉",
    test: (p) => {
      const cats = Object.values(p.cat);
      return (
        cats.length >= 6 &&
        cats.every((c) => c.total >= 5 && c.correct / c.total >= 0.6)
      );
    },
  },
  {
    id: "completionist",
    name: "Completionist",
    desc: "Play every room at least once",
    icon: "🏛️",
    test: (p) => ROOMS.every((r) => (p.plays[r] ?? 0) >= 1),
  },
];

export const levelFromXp = (xp: number) => 1 + Math.floor(xp / XP_PER_LEVEL);
export const xpIntoLevel = (xp: number) => xp % XP_PER_LEVEL;
export const xpPerLevel = XP_PER_LEVEL;

function load(): Profile {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Profile) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // quota / private mode — progression is best-effort
  }
}

/** Apply a finished run. Returns the updated profile + any newly-unlocked badges. */
export function applyResult(
  prev: Profile,
  r: GameResult,
): { profile: Profile; unlocked: Achievement[] } {
  const p: Profile = {
    ...prev,
    plays: { ...prev.plays },
    best: { ...prev.best },
    cat: { ...prev.cat },
    days: [...prev.days],
    history: [...prev.history],
    achievements: [...prev.achievements],
  };

  p.xp += Math.max(0, Math.round(r.xp ?? Math.min(r.score, 1000)));
  p.plays[r.room] = (p.plays[r.room] ?? 0) + 1;
  p.best[r.room] = Math.max(p.best[r.room] ?? 0, r.score);

  for (const [cat, v] of Object.entries(r.perCategory ?? {})) {
    if (!v) continue;
    const c = p.cat[cat as Category] ?? { correct: 0, total: 0 };
    p.cat[cat as Category] = {
      correct: c.correct + v.correct,
      total: c.total + v.total,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (!p.days.includes(today)) p.days.push(today);
  p.days.sort();

  p.history.push({ room: r.room, score: r.score, ts: Date.now() });
  if (p.history.length > MAX_HISTORY) p.history = p.history.slice(-MAX_HISTORY);

  const unlocked = ACHIEVEMENTS.filter(
    (a) => !p.achievements.includes(a.id) && a.test(p),
  );
  p.achievements.push(...unlocked.map((a) => a.id));

  save(p);
  return { profile: p, unlocked };
}

/** Hook: live profile + a record() that returns newly unlocked achievements. */
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(EMPTY);

  useEffect(() => {
    setProfile(load());
  }, []);

  const record = useCallback((r: GameResult): Achievement[] => {
    let unlocked: Achievement[] = [];
    setProfile((prev) => {
      const res = applyResult(prev, r);
      unlocked = res.unlocked;
      return res.profile;
    });
    return unlocked;
  }, []);

  return { profile, record };
}
