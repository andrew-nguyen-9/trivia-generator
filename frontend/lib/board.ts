// Pure board-arrangement helpers. Kept OUT of lib/queries.ts on purpose: that
// module statically imports the 232 KB seed bank, and BoardGame (a client
// component) calls buildBoardColumns for practice mode — importing it from
// queries dragged the whole seed bank into the /board client bundle (~76 KB).
// This module imports only types, so the client pays nothing for it.
import type { Category, Question } from "./types";

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
