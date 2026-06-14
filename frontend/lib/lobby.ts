import { getSupabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Question } from "./types";

export const TOTAL_QUESTIONS = 10;
export const BUZZ_WINDOW_SEC = 8;
export const ANSWER_WINDOW_SEC = 10;

export interface PlayerPresence {
  name: string;
  isHost: boolean;
}

export type GamePhase =
  | "entry"
  | "waiting"
  | "question"
  | "answering"
  | "reveal"
  | "podium";

export interface GameState {
  phase: GamePhase;
  questionIdx: number;
  totalQuestions: number;
  prompt: string;
  choices: string[];
  category: string;
  buzzedBy: string | null;
  correct: string | null;  // only populated in reveal
  wasCorrect: boolean | null;
  scores: Record<string, number>;
  startedAt: number;  // Date.now() when current timer started
  windowSec: number;  // how long the timer runs
}

export const BLANK_GAME: GameState = {
  phase: "entry",
  questionIdx: -1,
  totalQuestions: TOTAL_QUESTIONS,
  prompt: "",
  choices: [],
  category: "history",
  buzzedBy: null,
  correct: null,
  wasCorrect: null,
  scores: {},
  startedAt: 0,
  windowSec: BUZZ_WINDOW_SEC,
};

/** Generates a 4-letter room code (no I/O to avoid ambiguity). */
export function makeCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

/** Selects and shuffles multiple-choice questions for a lobby session. */
export function selectLobbyQuestions(pool: Question[], count: number): Question[] {
  const mc = pool.filter(
    (q) => q.qtype === "multiple_choice" && Array.isArray(q.choices) && q.choices.length >= 2,
  );
  if (mc.length === 0) return [];
  const arr = [...mc].sort(() => Math.random() - 0.5);
  return arr.slice(0, Math.min(count, arr.length));
}

/** Opens a Supabase Realtime channel for the given room code. */
export function openLobbyChannel(code: string): RealtimeChannel | null {
  const sb = getSupabase();
  if (!sb) return null;
  return sb.channel(`parlor:lobby:${code}`);
}
