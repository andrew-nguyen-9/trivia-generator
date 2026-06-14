// Levenshtein-based liberal answer matching for free-text Jeopardy (hard mode).
// Accepts: same string, one contained in the other, or ≤35% edit distance ratio.

function levenshtein(a: string, b: string): number {
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function liberalMatch(guess: string, correct: string): boolean {
  const g = normalize(guess);
  const c = normalize(correct);
  if (!g) return false;
  if (g === c) return true;
  if (c.includes(g) || g.includes(c)) return true;
  const dist = levenshtein(g, c);
  return dist / Math.max(g.length, c.length) <= 0.35;
}
