// ─────────────────────────────────────────────────────────────
// CLIMB OF THE INITIATE — daily logic/math ladder engine.
//
// A path-dependent sequence of 4–7 "rungs", each uniquely solvable, threaded by
// a Global Constraint Memory (GCM) "resonance" value carried up the staircase:
// each rung's parameters are derived from the resonance produced by the rungs
// below it, so the ascent is genuinely cumulative. Validation is immediate on
// Lock (resolving the spec's own contradiction — see GAMES.md §2.10).
//
// Pure + deterministic: generated once server-side (scripts/generate-ladder.ts)
// and archived to Neon (ladder_puzzles). The browser only renders. Three rung
// mechanisms, all with a single correct answer:
//   - grid     : LinkedIn-Queens (one sigil per row/col/region, none touching)
//   - sequence : pick the true next value; the "obvious" extrapolation is a decoy
//   - door     : pick the only assertion consistent with the resonance
// ─────────────────────────────────────────────────────────────
import { mulberry32, shuffled } from "./rng";
import { TRICKSTERS, LADDER_WEEKS, SIGILS } from "./ladderFlavor";

export type RungType = "grid" | "sequence" | "door";

export interface BaseRung {
  type: RungType;
  modifier: string; // trickster name
  whisper: string; // trickster line
  resonance: number; // GCM value entering this rung (shown to the player)
}

export interface GridRung extends BaseRung {
  type: "grid";
  n: number;
  sigils: string[]; // length n
  regions: number[][]; // [row][col] = region id (0..n-1)
  solution: number[]; // solution[row] = col of that row's sigil
  givens: number[]; // givens[row] = col if pre-placed, else -1
}

export interface SequenceRung extends BaseRung {
  type: "sequence";
  shown: number[]; // visible terms
  options: number[]; // candidate next values (one correct)
  answer: number; // the correct next value
  rule: string; // the true generator, described
}

export interface DoorRung extends BaseRung {
  type: "door";
  doors: string[]; // assertion text per door
  answer: number; // index of the only consistent door
}

export type Rung = GridRung | SequenceRung | DoorRung;

export interface LadderPuzzle {
  date: string;
  weekday: number;
  rite: string;
  trickster: string; // the week's host
  framing: string;
  rungs: Rung[];
  seed: number;
}

interface WeekdayConfig {
  rungs: number;
  gridN: number;
  rite: string;
}

export const WEEKDAY: Record<number, WeekdayConfig> = {
  1: { rungs: 4, gridN: 4, rite: "Stable Ascent" }, // Mon
  2: { rungs: 4, gridN: 4, rite: "First Distortion" }, // Tue
  3: { rungs: 5, gridN: 5, rite: "Dual Logic" }, // Wed
  4: { rungs: 5, gridN: 5, rite: "Layer Shift" }, // Thu
  5: { rungs: 6, gridN: 5, rite: "Adversarial Logic" }, // Fri
  6: { rungs: 6, gridN: 6, rite: "Ritual Instability" }, // Sat
  0: { rungs: 7, gridN: 6, rite: "The Impossible Ascent" }, // Sun
};

// ── Queens solver (one per row/col/region, no two orthogonally/diagonally
// adjacent). Counts solutions up to `cap` for the uniqueness gate. ──
export function solveQueens(
  n: number,
  regions: number[][],
  givens: number[],
  cap = 2,
): number {
  const cols = new Set<number>();
  const used = new Set<number>(); // region ids
  const place: number[] = Array(n).fill(-1);
  let count = 0;

  function ok(row: number, col: number): boolean {
    if (cols.has(col)) return false;
    const reg = regions[row][col];
    if (used.has(reg)) return false;
    if (row > 0) {
      const p = place[row - 1];
      if (p !== -1 && Math.abs(p - col) <= 1) return false; // touching
    }
    return true;
  }

  function rec(row: number): void {
    if (count >= cap) return;
    if (row === n) {
      count++;
      return;
    }
    const fixed = givens[row];
    const candidates = fixed >= 0 ? [fixed] : [...Array(n).keys()];
    for (const col of candidates) {
      if (!ok(row, col)) continue;
      place[row] = col;
      cols.add(col);
      used.add(regions[row][col]);
      rec(row + 1);
      cols.delete(col);
      used.delete(regions[row][col]);
      place[row] = -1;
      if (count >= cap) return;
    }
  }
  rec(0);
  return count;
}

// Build N contiguous regions, one seeded at each queen cell (multi-source flood).
function growRegions(n: number, sol: number[], rand: () => number): number[][] {
  const reg: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));
  const frontier: [number, number][][] = [];
  for (let r = 0; r < n; r++) {
    reg[r][sol[r]] = r;
    frontier.push([[r, sol[r]]]);
  }
  let remaining = n * n - n;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let guard = n * n * 8;
  while (remaining > 0 && guard-- > 0) {
    for (let id = 0; id < n && remaining > 0; id++) {
      const f = frontier[id];
      // gather all unassigned neighbors of this region's frontier
      const opts: [number, number][] = [];
      for (const [r, c] of f) {
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && reg[nr][nc] === -1) {
            opts.push([nr, nc]);
          }
        }
      }
      if (opts.length === 0) continue;
      const [pr, pc] = opts[Math.floor(rand() * opts.length)];
      reg[pr][pc] = id;
      f.push([pr, pc]);
      remaining--;
    }
  }
  // any stragglers (disconnected by greedy order) → assign to a neighbor's region
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (reg[r][c] !== -1) continue;
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && reg[nr][nc] !== -1) {
          reg[r][c] = reg[nr][nc];
          break;
        }
      }
      if (reg[r][c] === -1) reg[r][c] = 0;
    }
  }
  return reg;
}

function makeGrid(n: number, rand: () => number, resonance: number): GridRung {
  // a placement with no two queens in adjacent rows touching (|Δcol| >= 2)
  let sol: number[] = [];
  for (let tries = 0; tries < 400; tries++) {
    const perm = shuffled([...Array(n).keys()], rand);
    let valid = true;
    for (let r = 1; r < n; r++) {
      if (Math.abs(perm[r] - perm[r - 1]) <= 1) {
        valid = false;
        break;
      }
    }
    if (valid) {
      sol = perm;
      break;
    }
  }
  if (sol.length === 0) sol = [...Array(n).keys()]; // fallback (n large enough)

  const regions = growRegions(n, sol, rand);

  // reveal true cells until the puzzle is uniquely solvable
  const givens: number[] = Array(n).fill(-1);
  const order = shuffled([...Array(n).keys()], rand);
  let oi = 0;
  while (solveQueens(n, regions, givens) > 1 && oi < n) {
    givens[order[oi]] = sol[order[oi]];
    oi++;
  }

  return {
    type: "grid",
    modifier: "Prof. Marlow",
    whisper: TRICKSTERS.find((t) => t.name === "Prof. Marlow")!.whisper,
    resonance,
    n,
    sigils: SIGILS.slice(0, n),
    regions,
    solution: sol,
    givens,
  };
}

// ── Sequence rung — true generator vs. the obvious-but-wrong extrapolation ──
function makeSequence(rand: () => number, resonance: number): SequenceRung {
  const kind = Math.floor(rand() * 4);
  const k = 4; // shown terms
  let f: (n: number) => number;
  let rule: string;
  const a = 2 + (resonance % 3); // GCM-tuned parameter
  const c = 1 + (resonance % 4);
  if (kind === 0) {
    f = (n) => c + a * n * n; // quadratic
    rule = `add ${a}×n² to ${c}`;
  } else if (kind === 1) {
    f = (n) => (n * (n + 1)) / 2 + c; // triangular
    rule = `the nth triangular number, plus ${c}`;
  } else if (kind === 2) {
    f = (n) => c * Math.pow(2, n); // geometric-ish
    rule = `${c} doubled n times`;
  } else {
    f = (n) => c + a * n + n * n; // n² + a·n + c
    rule = `n² + ${a}·n + ${c}`;
  }
  const shown = Array.from({ length: k }, (_, i) => f(i + 1));
  const answer = f(k + 1);
  // the decoy: linear continuation from the last gap (the "illusion")
  const naive = shown[k - 1] + (shown[k - 1] - shown[k - 2]);
  const far = answer + (kind === 2 ? c : a) + 1;
  const opts = new Set<number>([answer, naive, far]);
  let salt = 1;
  while (opts.size < 3) opts.add(answer + salt++ * (a + 1));
  const options = shuffled([...opts], rand);
  const trick = TRICKSTERS[0]; // Loki
  return {
    type: "sequence",
    modifier: trick.name,
    whisper: trick.whisper,
    resonance,
    shown,
    options,
    answer,
    rule,
  };
}

// ── Door rung — exactly one assertion about the resonance is true ──
function makeDoor(rand: () => number, resonance: number): DoorRung {
  const r = resonance;
  const preds: { text: string; holds: boolean }[] = [
    { text: `The resonance ⟨${r}⟩ is even.`, holds: r % 2 === 0 },
    { text: `The resonance ⟨${r}⟩ is odd.`, holds: r % 2 === 1 },
    { text: `The resonance ⟨${r}⟩ is one less than a multiple of three.`, holds: (r + 1) % 3 === 0 },
    { text: `The resonance ⟨${r}⟩ is a multiple of three.`, holds: r % 3 === 0 },
    { text: `The resonance ⟨${r}⟩ is prime.`, holds: [2, 3, 5, 7, 11, 13].includes(r) },
    { text: `The resonance ⟨${r}⟩ is a perfect square.`, holds: [0, 1, 4, 9, 16].includes(r) },
  ];
  const truths = shuffled(preds.filter((p) => p.holds), rand);
  const falses = shuffled(preds.filter((p) => !p.holds), rand);
  // exactly one true door + two false (predicates are mutually consistent enough
  // that at least one true + two false always exist for r in our range).
  const chosen = [truths[0], falses[0], falses[1]].filter(Boolean);
  const ordered = shuffled(chosen, rand);
  const answer = ordered.indexOf(truths[0]);
  const trick = TRICKSTERS[2]; // Silas Crowe — the causal looper
  return {
    type: "door",
    modifier: trick.name,
    whisper: trick.whisper,
    resonance,
    doors: ordered.map((d) => d.text),
    answer,
  };
}

// resonance transition along the true ascent
function nextResonance(res: number, rung: Rung): number {
  let bump = 0;
  if (rung.type === "grid") bump = rung.solution.reduce((s, c, r) => s + c * (r + 1), 0);
  else if (rung.type === "sequence") bump = rung.answer;
  else bump = rung.answer + 3;
  return ((res + bump) % 12) + 1; // kept small so door predicates stay meaningful
}

/** Build the deterministic daily ladder for `dayIndex` / `date`. Pure. */
export function generateLadder(dayIndex: number, date: string): LadderPuzzle {
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  const cfg = WEEKDAY[weekday];
  const seed = (dayIndex ^ 0x1adde7) >>> 0;
  const rand = mulberry32(seed);

  const framing = LADDER_WEEKS[Math.floor(dayIndex / 7) % LADDER_WEEKS.length];

  // rung-type plan: first rung is always a grid; then cycle through the three so
  // every ladder uses all mechanisms once it's long enough.
  const cycle: RungType[] = ["grid", "sequence", "door"];
  const plan: RungType[] = [];
  for (let i = 0; i < cfg.rungs; i++) plan.push(cycle[i % 3]);

  let res = (seed % 9) + 1;
  const rungs: Rung[] = [];
  for (const t of plan) {
    let rung: Rung;
    if (t === "grid") rung = makeGrid(cfg.gridN, rand, res);
    else if (t === "sequence") rung = makeSequence(rand, res);
    else rung = makeDoor(rand, res);
    rungs.push(rung);
    res = nextResonance(res, rung);
  }

  return {
    date,
    weekday,
    rite: cfg.rite,
    trickster: "Loki", // the Illusionist of the Order hosts the climb
    framing,
    rungs,
    seed,
  };
}
