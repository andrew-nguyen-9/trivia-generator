// All data access lives here (house convention). Every helper tries the database
// (Neon) first and silently falls back to the committed seed bank, so the app
// works from `git clone` with zero env vars.

import seed from "../public/seed-questions.json";
import { getDb } from "./db";
import type { Category, Question, QType } from "./types";
import type { SeancePuzzle } from "./seance";
import type { LadderPuzzle } from "./ladder";

const SEED_BANK = (seed as { questions: Question[] }).questions;

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
 * Unlike every other room, there is NO seed-bank fallback: the puzzle is
 * generated server-side and archived to Neon, so without a row (or without a
 * DB) the room is dark. `date` (YYYY-MM-DD) enables archive-play of past days;
 * defaults to today (UTC).
 */
export async function getSeancePuzzle(date?: string): Promise<SeancePuzzle | null> {
  const sql = getDb();
  if (!sql) return null;
  const day = date ?? new Date().toISOString().slice(0, 10);
  try {
    const rows = await sql`
      select payload from seance_puzzles where play_date = ${day} limit 1`;
    if (rows.length > 0) return rows[0].payload as SeancePuzzle;
  } catch {
    // db hiccup → dark state, never throw (and never fall back to a fake puzzle)
  }
  return null;
}

/**
 * CLIMB OF THE INITIATE — fetch one day's pre-generated ladder. Same archive
 * contract as the Séance: read-only, NO seed fallback (absent row / no DB ⇒ the
 * room is dark). `date` (YYYY-MM-DD) enables archive-play; defaults to today.
 */
export async function getLadderPuzzle(date?: string): Promise<LadderPuzzle | null> {
  const sql = getDb();
  if (!sql) return null;
  const day = date ?? new Date().toISOString().slice(0, 10);
  try {
    const rows = await sql`
      select payload from ladder_puzzles where play_date = ${day} limit 1`;
    if (rows.length > 0) return rows[0].payload as LadderPuzzle;
  } catch {
    // db hiccup → dark state, never throw, never fabricate a puzzle
  }
  return null;
}

// Board arrangement lives in lib/board.ts (seed-free) so client components can
// import it without pulling this module's 232 KB seed bank. Re-exported here for
// server callers that already import from queries.
export { buildBoardColumns, type BoardColumn } from "./board";
