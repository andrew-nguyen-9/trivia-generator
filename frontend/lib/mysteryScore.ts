import type { MysteryCase } from "./mystery";

export type SuspectTag = "potential" | "prime" | "cleared" | undefined;

export interface MysteryAttempt {
  whoGuess: string[];
  whereGuess: string | null;
  whenGuess: number | null;
  cluesRevealed: number;
  elapsedSeconds: number;
  tableTags: Record<string, SuspectTag>;
  autoMarkUsed: boolean;
}

export interface MysteryScoreBreakdown {
  base: number;
  cluePenalty: number;
  timePenalty: number;
  tableBonus: number;
}

export interface MysteryScoreResult {
  total: number;
  won: boolean;
  breakdown: MysteryScoreBreakdown;
}

const BASE_SCORE = 1000;
const CLUE_PENALTY = 80;
const TABLE_BONUS = 40;

export function score(c: MysteryCase, a: MysteryAttempt): MysteryScoreResult {
  const base = BASE_SCORE;
  const cluePenalty = CLUE_PENALTY * Math.max(0, a.cluesRevealed - 1);
  const timePenalty = Math.floor(a.elapsedSeconds / 5);

  const culpritSet = new Set(c.culprits);
  let correctTags = 0;
  for (const s of c.suspects) {
    const tag = a.tableTags[s.id];
    const isCulprit = culpritSet.has(s.id);
    if (isCulprit && tag === "prime") correctTags++;
    if (!isCulprit && tag === "cleared") correctTags++;
  }
  const tableBonus = TABLE_BONUS * correctTags;

  const autoMarkPenalty = a.autoMarkUsed ? 150 : 0;
  const afterPenalties = Math.max(0, base - cluePenalty - timePenalty - autoMarkPenalty);
  const total = afterPenalties + tableBonus;

  const whoGuessSet = new Set(a.whoGuess);
  const whoCorrect =
    whoGuessSet.size === culpritSet.size &&
    [...whoGuessSet].every((id) => culpritSet.has(id));
  const won = whoCorrect && a.whereGuess === c.scene && a.whenGuess === c.hourIndex;

  return { total, won, breakdown: { base, cluePenalty, timePenalty, tableBonus } };
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function shareText(c: MysteryCase, a: MysteryAttempt, result: MysteryScoreResult): string {
  const headline = result.won
    ? `🕵️ PARLOR — CASE #${c.caseNumber} — CASE CLOSED 🔓`
    : `🕵️ PARLOR — CASE #${c.caseNumber} — COLD CASE ❄️`;
  const stats = `Score: ${result.total} · Clues: ${a.cluesRevealed}/${c.clues.length} · Time: ${formatClock(a.elapsedSeconds)}`;
  const squares = c.clues.map((_, i) => (i < a.cluesRevealed ? "🟨" : "🟩")).join("");
  return `${headline}\n${stats}\n${squares}`;
}
