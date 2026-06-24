// ─────────────────────────────────────────────────────────────
// THE SÉANCE — daily constraint-logic puzzle engine.
//
// A pure, deterministic CSP generator: given a dayIndex it produces exactly ONE
// uniquely-solvable logic grid (a single-anchor "zebra" puzzle). The expensive
// work — building the truth matrix, then the Subtraction Method (prune a clue,
// re-solve, keep only if still unique) — runs ONCE, server-side, in
// scripts/generate-seance.ts, and the result is archived to Neon. The browser
// never generates; it only renders a fetched SeancePuzzle. No RNG at solve time.
//
// Model: N "seats" (0..N-1, the ordered anchor axis) and K non-anchor categories
// (relic, sin, …), each a bijection assigning its N values to the N seats.
// Every clue reduces to a constraint on seat positions, so the solver reasons in
// one space. Difficulty scales by N and K (see WEEKDAY).
// ─────────────────────────────────────────────────────────────
import { mulberry32, hashKey, shuffled } from "./rng";
import { SPIRIT_PACKS } from "./seanceFlavor";

export type ClueType = "at" | "same" | "diff" | "order" | "neighbor";

/** A value: category index (0..K-1 over `categories`) + value index (0..N-1). */
export interface Ref {
  cat: number;
  val: number;
}

export interface Clue {
  type: ClueType;
  a: Ref;
  b?: Ref; // same | diff | order | neighbor
  seat?: number; // at (0-based)
  text: string; // themed rendering
}

export interface SeanceCategory {
  key: string;
  label: string;
  values: string[]; // length N
}

export interface SeancePuzzle {
  date: string; // YYYY-MM-DD
  weekday: number; // 0=Sun..6=Sat
  rite: string; // weekday label, e.g. "The Initiation"
  spirit: string; // weekly spirit name
  backstory: string;
  n: number; // grid dimension
  categories: SeanceCategory[]; // length K
  clues: Clue[];
  // solution[c][seat] = value index. Included so the client can validate the
  // board offline; ponytail: cheating a logic puzzle's own timer isn't a threat
  // worth a server round-trip per move. Upgrade to server-side check if it ever is.
  solution: number[][];
  seed: number;
  whisper: boolean; // whisper-mode scratchpad available (Fri–Sun)
}

interface WeekdayConfig {
  n: number;
  cats: number;
  rite: string;
  whisper: boolean;
}

// Mon intro → Sun exorcism. cats = non-anchor categories (sub-grids).
export const WEEKDAY: Record<number, WeekdayConfig> = {
  1: { n: 4, cats: 2, rite: "The Initiation", whisper: false }, // Mon
  2: { n: 4, cats: 2, rite: "First Contact", whisper: false }, // Tue
  3: { n: 5, cats: 3, rite: "The Deepening", whisper: false }, // Wed
  4: { n: 5, cats: 3, rite: "The Veil Thins", whisper: false }, // Thu
  5: { n: 6, cats: 3, rite: "The Haunting", whisper: true }, // Fri
  6: { n: 6, cats: 3, rite: "Restless Dead", whisper: true }, // Sat
  0: { n: 7, cats: 4, rite: "The Exorcism", whisper: true }, // Sun
};

// ── Solver ───────────────────────────────────────────────────
// Variables are value-positions: vid(c,v) = seat of value v in category c, with
// domain {0..N-1}. all-different per category + binary clue constraints. We only
// ever need to know "1 vs ≥2 solutions", so the count is capped at 2.

interface SolveConstraint {
  type: ClueType;
  x: number; // vid
  y?: number; // vid
  seat?: number;
}

const vid = (c: number, v: number, n: number) => c * n + v;

function cloneDomains(dom: boolean[][]): boolean[][] {
  return dom.map((d) => d.slice());
}

function domSeats(d: boolean[]): number[] {
  const out: number[] = [];
  for (let s = 0; s < d.length; s++) if (d[s]) out.push(s);
  return out;
}

/** Fixpoint constraint propagation. Returns false on contradiction. */
function propagate(
  dom: boolean[][],
  cons: SolveConstraint[],
  n: number,
  cats: number,
): boolean {
  let changed = true;
  while (changed) {
    changed = false;

    // all-different within each category: a singleton seat is removed elsewhere.
    for (let c = 0; c < cats; c++) {
      for (let v = 0; v < n; v++) {
        const seats = domSeats(dom[vid(c, v, n)]);
        if (seats.length === 1) {
          const s = seats[0];
          for (let w = 0; w < n; w++) {
            if (w === v) continue;
            const id = vid(c, w, n);
            if (dom[id][s]) {
              dom[id][s] = false;
              changed = true;
            }
          }
        }
      }
      // hidden single: a seat reachable by only one value in the category.
      for (let s = 0; s < n; s++) {
        let only = -1;
        let cnt = 0;
        for (let v = 0; v < n; v++) {
          if (dom[vid(c, v, n)][s]) {
            cnt++;
            only = v;
          }
        }
        if (cnt === 0) return false;
        if (cnt === 1) {
          const id = vid(c, only, n);
          for (let s2 = 0; s2 < n; s2++) {
            if (s2 !== s && dom[id][s2]) {
              dom[id][s2] = false;
              changed = true;
            }
          }
        }
      }
    }

    for (const con of cons) {
      const dx = dom[con.x];
      if (con.type === "same" && con.y !== undefined) {
        const dy = dom[con.y];
        for (let s = 0; s < n; s++) {
          const both = dx[s] && dy[s];
          if (dx[s] !== both) {
            dx[s] = both;
            changed = true;
          }
          if (dy[s] !== both) {
            dy[s] = both;
            changed = true;
          }
        }
      } else if (con.type === "diff" && con.y !== undefined) {
        const dy = dom[con.y];
        const sx = domSeats(dx);
        const sy = domSeats(dy);
        if (sx.length === 1 && dy[sx[0]]) {
          dy[sx[0]] = false;
          changed = true;
        }
        if (sy.length === 1 && dx[sy[0]]) {
          dx[sy[0]] = false;
          changed = true;
        }
      } else if (con.type === "order" && con.y !== undefined) {
        // seat(x) < seat(y)
        const dy = dom[con.y];
        const maxY = Math.max(...domSeats(dy));
        const minX = Math.min(...domSeats(dx));
        for (let s = 0; s < n; s++) {
          if (dx[s] && s >= maxY) {
            dx[s] = false;
            changed = true;
          }
          if (dy[s] && s <= minX) {
            dy[s] = false;
            changed = true;
          }
        }
      } else if (con.type === "neighbor" && con.y !== undefined) {
        const dy = dom[con.y];
        for (let s = 0; s < n; s++) {
          if (dx[s] && !((s > 0 && dy[s - 1]) || (s < n - 1 && dy[s + 1]))) {
            dx[s] = false;
            changed = true;
          }
          if (dy[s] && !((s > 0 && dx[s - 1]) || (s < n - 1 && dx[s + 1]))) {
            dy[s] = false;
            changed = true;
          }
        }
      }
      if (domSeats(dx).length === 0) return false;
      if (con.y !== undefined && domSeats(dom[con.y]).length === 0) return false;
    }
  }
  return true;
}

/** Count solutions up to `cap` (default 2 — we only care about uniqueness). */
function countSolutions(
  dom: boolean[][],
  cons: SolveConstraint[],
  n: number,
  cats: number,
  cap = 2,
): number {
  if (!propagate(dom, cons, n, cats)) return 0;

  // pick the most-constrained unsolved variable
  let best = -1;
  let bestLen = Infinity;
  for (let id = 0; id < cats * n; id++) {
    const len = domSeats(dom[id]).length;
    if (len > 1 && len < bestLen) {
      bestLen = len;
      best = id;
    }
  }
  if (best === -1) return 1; // all singletons → one solution

  let total = 0;
  for (const s of domSeats(dom[best])) {
    const next = cloneDomains(dom);
    next[best] = next[best].map((_, i) => i === s);
    total += countSolutions(next, cons, n, cats, cap - total);
    if (total >= cap) return total;
  }
  return total;
}

function toSolveConstraints(clues: Clue[], n: number): SolveConstraint[] {
  return clues.map((cl) => ({
    type: cl.type,
    x: vid(cl.a.cat, cl.a.val, n),
    y: cl.b ? vid(cl.b.cat, cl.b.val, n) : undefined,
    seat: cl.seat,
  }));
}

function initDomains(
  clues: Clue[],
  n: number,
  cats: number,
): boolean[][] {
  const dom: boolean[][] = [];
  for (let i = 0; i < cats * n; i++) dom.push(Array(n).fill(true));
  for (const cl of clues) {
    if (cl.type === "at" && cl.seat !== undefined) {
      const id = vid(cl.a.cat, cl.a.val, n);
      dom[id] = dom[id].map((_, i) => i === cl.seat);
    }
  }
  return dom;
}

/** Public: how many solutions does this clue set admit (capped at 2)? */
export function solutionCount(
  clues: Clue[],
  n: number,
  cats: number,
): number {
  return countSolutions(
    initDomains(clues, n, cats),
    toSolveConstraints(clues, n),
    n,
    cats,
  );
}

// ── Clue text ────────────────────────────────────────────────
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

function renderClue(
  type: ClueType,
  a: Ref,
  b: Ref | undefined,
  seat: number | undefined,
  cats: SeanceCategory[],
): string {
  const name = (r: Ref) => cats[r.cat].values[r.val];
  switch (type) {
    case "at":
      return `${name(a)} took the ${ORDINALS[seat!]} seat at the table.`;
    case "same":
      return `${name(a)} and ${name(b!)} mark the same soul.`;
    case "diff":
      return `${name(a)} and ${name(b!)} never touch the same soul.`;
    case "order":
      return `${name(a)} sits somewhere left of ${name(b!)}.`;
    case "neighbor":
      return `${name(a)} sits directly beside ${name(b!)}.`;
  }
}

// ── Generation ───────────────────────────────────────────────

/** Build the full pool of TRUE clues about a solution, richest-first by type. */
function candidateClues(
  solution: number[][], // [cat][seat] = valueIndex
  cats: SeanceCategory[],
  n: number,
): Clue[] {
  const K = cats.length;
  // posOf[cat][val] = seat
  const posOf: number[][] = cats.map((_, c) => {
    const arr = Array(n).fill(0);
    for (let s = 0; s < n; s++) arr[solution[c][s]] = s;
    return arr;
  });
  const ref = (c: number, v: number): Ref => ({ cat: c, val: v });
  const mk = (type: ClueType, a: Ref, b?: Ref, seat?: number): Clue => ({
    type,
    a,
    b,
    seat,
    text: renderClue(type, a, b, seat, cats),
  });

  const out: Clue[] = [];
  // "same": co-located values across category pairs.
  for (let c1 = 0; c1 < K; c1++) {
    for (let c2 = c1 + 1; c2 < K; c2++) {
      for (let s = 0; s < n; s++) {
        out.push(mk("same", ref(c1, solution[c1][s]), ref(c2, solution[c2][s])));
      }
    }
  }
  // "neighbor": adjacent seats across category pairs.
  for (let c1 = 0; c1 < K; c1++) {
    for (let c2 = 0; c2 < K; c2++) {
      if (c1 === c2) continue;
      for (let s = 0; s < n - 1; s++) {
        out.push(
          mk("neighbor", ref(c1, solution[c1][s]), ref(c2, solution[c2][s + 1])),
        );
      }
    }
  }
  // "at": absolute seat pins.
  for (let c = 0; c < K; c++) {
    for (let v = 0; v < n; v++) {
      out.push(mk("at", ref(c, v), undefined, posOf[c][v]));
    }
  }
  // "order": full pairwise ordering (guarantees the full set is unique).
  for (let c1 = 0; c1 < K; c1++) {
    for (let c2 = 0; c2 < K; c2++) {
      for (let v1 = 0; v1 < n; v1++) {
        for (let v2 = 0; v2 < n; v2++) {
          if (c1 === c2 && v1 === v2) continue;
          if (posOf[c1][v1] < posOf[c2][v2]) {
            out.push(mk("order", ref(c1, v1), ref(c2, v2)));
          }
        }
      }
    }
  }
  return out;
}

// Removal priority: prune "boring" clue types first so the minimal set keeps the
// more interesting (same/neighbor/at) reasoning. Lower = removed earlier.
const PRUNE_PRIORITY: Record<ClueType, number> = {
  order: 0,
  diff: 1,
  at: 2,
  neighbor: 3,
  same: 4,
};

/**
 * Generate the deterministic daily Séance for `dayIndex` (and the matching
 * YYYY-MM-DD string). Pure: same inputs → byte-identical puzzle.
 */
export function generateSeance(dayIndex: number, date: string): SeancePuzzle {
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  const cfg = WEEKDAY[weekday];
  const n = cfg.n;

  const seed = (dayIndex ^ 0x53e4) >>> 0;
  const rand = mulberry32(seed);

  // weekly spirit (rotates by ISO-ish week number derived from dayIndex)
  const pack = SPIRIT_PACKS[Math.floor(dayIndex / 7) % SPIRIT_PACKS.length];

  // pick `cats` categories and N values each, deterministically.
  const chosenCats = shuffled(pack.categories, rand).slice(0, cfg.cats);
  const categories: SeanceCategory[] = chosenCats.map((fc) => ({
    key: fc.key,
    label: fc.label,
    values: shuffled(fc.values, rand).slice(0, n),
  }));

  // truth matrix: each category gets a seat permutation. solution[c][seat]=val.
  const solution: number[][] = categories.map(() => shuffled(
    Array.from({ length: n }, (_, i) => i),
    rand,
  ));

  // candidate clues → seeded shuffle → Subtraction Method down to a minimal,
  // uniquely-solvable set, pruning boring types first.
  const candidates = shuffled(candidateClues(solution, categories, n), rand).sort(
    (a, b) => PRUNE_PRIORITY[a.type] - PRUNE_PRIORITY[b.type],
  );

  let clues = candidates;
  for (let i = 0; i < candidates.length; i++) {
    const trial = clues.filter((c) => c !== candidates[i]);
    if (solutionCount(trial, n, categories.length) === 1) {
      clues = trial;
    }
  }

  // final order: present absolute/interesting clues first for readability.
  clues = [...clues].sort(
    (a, b) => PRUNE_PRIORITY[b.type] - PRUNE_PRIORITY[a.type],
  );

  return {
    date,
    weekday,
    rite: cfg.rite,
    spirit: pack.name,
    backstory: pack.backstory,
    n,
    categories,
    clues,
    solution,
    seed,
    whisper: cfg.whisper,
  };
}
