// Global leaderboard — null-safe like the rest of the app.
//
// When NEXT_PUBLIC_SUPABASE_URL is set, scores POST to the `submit-score` Edge
// Function (which writes with the service role server-side, so the anon client
// never writes to the DB directly — house rule intact) and the top list is read
// from the public `leaderboard` view. With no backend configured it transparently
// falls back to a LOCAL leaderboard kept in localStorage, so the feature is fully
// playable from a clone and upgrades to global the instant Supabase is wired.

"use client";

import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { Room } from "./profile";

export interface ScoreRow {
  room: string;
  name: string;
  score: number;
  created_at?: string;
  local?: boolean;
}

const localKey = (room: string) => `parlor:lb:${room}`;
const NAME_KEY = "parlor:lb:name";

export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function saveName(name: string): void {
  if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, name.slice(0, 12));
}

function readLocal(room: string): ScoreRow[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(localKey(room)) ?? "[]") as ScoreRow[];
  } catch {
    return [];
  }
}

function writeLocal(room: string, rows: ScoreRow[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(localKey(room), JSON.stringify(rows.slice(0, 20)));
}

export const usesGlobalLeaderboard = () => isSupabaseConfigured();

/** Submit a score. Returns the refreshed top list for that room. */
export async function submitScore(
  room: Room,
  name: string,
  score: number,
): Promise<ScoreRow[]> {
  const clean = (name.trim() || "Anon").slice(0, 12);
  saveName(clean);

  if (isSupabaseConfigured()) {
    try {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${base}/functions/v1/submit-score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({ room, name: clean, score }),
      });
      if (res.ok) return fetchTop(room);
    } catch {
      // network/function error — fall through to local so the UI still responds
    }
  }

  // Local fallback (or backend failure): keep a personal/device top list.
  const rows = [...readLocal(room), { room, name: clean, score, local: true }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  writeLocal(room, rows);
  return rows;
}

/** Top scores for a room (global when configured, else local). */
export async function fetchTop(room: Room, limit = 10): Promise<ScoreRow[]> {
  if (isSupabaseConfigured()) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb
        .from("leaderboard")
        .select("room, name, score, created_at")
        .eq("room", room)
        .order("score", { ascending: false })
        .limit(limit);
      if (!error && data) return data as ScoreRow[];
    }
  }
  return readLocal(room).slice(0, limit);
}
