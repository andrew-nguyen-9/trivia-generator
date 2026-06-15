// Deterministic PRNG — daily game sets are seeded by the date so everyone
// plays the same board (and SSR/client renders agree).

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function daySeed(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return Math.floor(d.getTime() / 86400000);
}

export function shuffled<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// No-repeat daily rotation. Instead of reshuffling the whole pool every day
// (which lets a question resurface by chance), we fix ONE permutation and walk
// it in non-overlapping windows that advance by date. A given question won't
// reappear until the entire pool has been cycled — ⌈pool/count⌉ days — with no
// stored state, so it stays SSR-deterministic and identical for every player.
//
// The permutation is seeded by pool length, so when the nightly bank grows the
// deck reshuffles and freshly-scraped questions enter rotation immediately.
export function pickRotating<T>(pool: T[], count: number, dayIndex = daySeed()): T[] {
  const n = pool.length;
  if (n === 0) return [];
  const perm = shuffled(pool, mulberry32(0x9e3779b9 ^ n));
  const start = (((dayIndex * count) % n) + n) % n;
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, n); i++) {
    out.push(perm[(start + i) % n]);
  }
  return out;
}
