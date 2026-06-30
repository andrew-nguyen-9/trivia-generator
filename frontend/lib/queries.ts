// All data access lives here (house convention). Every helper tries the database
// (Neon) first and silently falls back to the committed seed bank, so the app
// works from `git clone` with zero env vars.

import { unstable_cache } from "next/cache";
import seed from "../public/seed-questions.json";
import { getDb } from "./db";
import type { Question, QType } from "./types";
import { generateSeance, type SeancePuzzle } from "./seance";
import { generateLadder, type LadderPuzzle } from "./ladder";

const SEED_BANK = (seed as { questions: Question[] }).questions;

// Epoch-day index from a YYYY-MM-DD string, UTC-anchored so SSR stays
// deterministic regardless of server timezone. Same pure computation the
// nightly archiver (`daySeed` over a UTC-midnight Date) and the puzzle
// generators rely on — used below to generate offline puzzles on the fly.
function dayIndexOf(day: string): number {
  return Math.floor(Date.parse(day + "T00:00:00Z") / 86_400_000);
}

export async function getQuestionsByType(qtype: QType): Promise<Question[]> {
  const sql = getDb();
  if (sql) {
    try {
      const rows = await sql`
        select qtype, category, difficulty, prompt, correct, choices, year,
               value_a, value_b, subject_a, subject_b, unit, lat, lng,
               image_url, source_url, audio_url, melody, groups, clues, candidates
        from questions
        where qtype = ${qtype}
        limit 500`;
      if (rows.length > 0) return rows as Question[];
    } catch {
      // network/db hiccup → fall through to the bundled seed bank, never throw
    }
  }
  return SEED_BANK.filter((q) => q.qtype === qtype);
}

/**
 * THE SÉANCE — fetch one day's pre-generated puzzle from the archive.
 * DB-connected: reads the row Neon archived (so an un-archived date stays
 * dark — archive-play of a real night that never happened should say so).
 * DB-less (zero env vars): `generateSeance` is pure, so we run it inline —
 * same puzzle the nightly archiver would have written. `date` (YYYY-MM-DD)
 * defaults to today (UTC).
 */
// ponytail: per-day cache wrapper. The puzzle is deterministic per date, so the
// Neon read is keyed by `day` (the fn argument joins unstable_cache's key) and
// re-served from Next's data cache on every later same-day hit ⇒ one read/day.
// A real DB hiccup THROWS so the rejection is NOT cached (the outer wrapper
// catches → dark state); only successful reads — including a legit "no row yet"
// null — get stored. Ceiling: a missing row caches as null for `revalidate`
// seconds; harmless because puzzles are archived nightly before serving — drop
// `revalidate` if a same-day backfill must appear immediately.
const cachedSeance = unstable_cache(
  async (day: string): Promise<SeancePuzzle | null> => {
    const sql = getDb()!;
    const rows = await sql`
      select payload from seance_puzzles where play_date = ${day} limit 1`;
    return rows.length > 0 ? (rows[0].payload as SeancePuzzle) : null;
  },
  ["seance-puzzle"],
  { revalidate: 86_400 },
);

export async function getSeancePuzzle(date?: string): Promise<SeancePuzzle | null> {
  const day = date ?? new Date().toISOString().slice(0, 10);
  const sql = getDb();
  if (!sql) return generateSeance(dayIndexOf(day), day); // offline ⇒ generate, never dark
  try {
    return await cachedSeance(day);
  } catch {
    return null; // db hiccup → dark state, never throw, don't poison the cache
  }
}

/**
 * CLIMB OF THE INITIATE — fetch one day's pre-generated ladder. Same archive
 * contract as the Séance: DB-connected reads the archived row (absent row ⇒
 * dark, archive-play of a day that wasn't generated); DB-less runs the pure
 * `generateLadder` inline. `date` (YYYY-MM-DD) defaults to today.
 */
// ponytail: same per-day cache wrapper as the Séance (see cachedSeance above).
const cachedLadder = unstable_cache(
  async (day: string): Promise<LadderPuzzle | null> => {
    const sql = getDb()!;
    const rows = await sql`
      select payload from ladder_puzzles where play_date = ${day} limit 1`;
    return rows.length > 0 ? (rows[0].payload as LadderPuzzle) : null;
  },
  ["ladder-puzzle"],
  { revalidate: 86_400 },
);

export async function getLadderPuzzle(date?: string): Promise<LadderPuzzle | null> {
  const day = date ?? new Date().toISOString().slice(0, 10);
  const sql = getDb();
  if (!sql) return generateLadder(dayIndexOf(day), day); // offline ⇒ generate, never dark
  try {
    return await cachedLadder(day);
  } catch {
    return null; // db hiccup → dark state, never throw, don't poison the cache
  }
}

// Board arrangement lives in lib/board.ts (seed-free) so client components can
// import it without pulling this module's 232 KB seed bank. Re-exported here for
// server callers that already import from queries.
export { buildBoardColumns, type BoardColumn } from "./board";
