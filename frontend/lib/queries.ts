// All data access lives here (house convention). Every helper tries the database
// (Neon) first and silently falls back to the committed seed bank, so the app
// works from `git clone` with zero env vars.

import seed from "../public/seed-questions.json";
import { getDb } from "./db";
import type { Category, Question, QType } from "./types";

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

export interface BoardColumn {
  category: Category;
  cells: Question[]; // 5 clues, difficulty 1..5
}

/** Group clues into 5 columns × 5 difficulty rows for THE BOARD. */
export function buildBoardColumns(
  clues: Question[],
  pick: (arr: Question[]) => Question,
): BoardColumn[] {
  const byCat = new Map<Category, Question[]>();
  for (const q of clues) {
    byCat.set(q.category, [...(byCat.get(q.category) ?? []), q]);
  }
  const columns: BoardColumn[] = [];
  for (const [category, rows] of byCat) {
    if (columns.length === 5) break;
    const cells: Question[] = [];
    for (let d = 1; d <= 5; d++) {
      const tier = rows.filter((q) => q.difficulty === d);
      cells.push(pick(tier.length ? tier : rows));
    }
    columns.push({ category, cells });
  }
  return columns;
}
