// CLIMB OF THE INITIATE — daily puzzle generator / archiver. Mirrors
// generate-seance.ts: deterministic generation for today + a buffer of future
// days, upserted into the Neon `ladder_puzzles` archive (WRITE role).
//
//   DATABASE_URL=...  npx tsx scripts/generate-ladder.ts [daysAhead] [backfill]

import { neon } from "@neondatabase/serverless";
import { daySeed } from "../lib/rng";
import { generateLadder } from "../lib/ladder";

const dsn =
  process.env.DATABASE_URL ??
  process.env.NEON_DATABASE_URL ??
  process.env.CONNECTION_STRING;

async function main() {
  if (!dsn) {
    console.error("✗ no DATABASE_URL — cannot write the Ladder archive");
    process.exit(1);
  }
  const sql = neon(dsn);
  const daysAhead = Number(process.argv[2] ?? 14);
  const backfill = Number(process.argv[3] ?? 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let written = 0;
  for (let off = -backfill; off <= daysAhead; off++) {
    const d = new Date(today.getTime() + off * 86400000);
    const date = d.toISOString().slice(0, 10);
    const p = generateLadder(daySeed(d), date);

    await sql`
      insert into ladder_puzzles (play_date, weekday, rite, seed, payload)
      values (${date}, ${p.weekday}, ${p.rite}, ${p.seed}, ${JSON.stringify(p)})
      on conflict (play_date) do update
        set weekday = excluded.weekday,
            rite    = excluded.rite,
            seed    = excluded.seed,
            payload = excluded.payload`;
    written++;
    console.log(`🪜 ${date}  ${p.rite} (${p.rungs.length} rungs)`);
  }
  console.log(`\nLadder archive: ${written} day(s) written.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
