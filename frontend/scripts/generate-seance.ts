// THE SÉANCE — daily puzzle generator / archiver.
//
// Runs server-side (CI cron, see .github/workflows/etl_daily.yml). Generates the
// deterministic puzzle for today + a buffer of future days and upserts each into
// the Neon `seance_puzzles` archive using the WRITE role. The frontend only ever
// reads. Idempotent: re-running a day overwrites with the (identical) payload.
//
//   DATABASE_URL=...  npx tsx scripts/generate-seance.ts [daysAhead] [backfill]
//
// daysAhead (default 14): future days to pre-generate. backfill (default 0):
// past days to also (re)generate, handy for archive repair.

import { neon } from "@neondatabase/serverless";
import { daySeed } from "../lib/rng";
import { generateSeance } from "../lib/seance";

const dsn =
  process.env.DATABASE_URL ??
  process.env.NEON_DATABASE_URL ??
  process.env.CONNECTION_STRING;

async function main() {
  if (!dsn) {
    console.error("✗ no DATABASE_URL — cannot write the Séance archive");
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
    const dayIndex = daySeed(d);
    const p = generateSeance(dayIndex, date);

    await sql`
      insert into seance_puzzles (play_date, weekday, spirit, seed, payload)
      values (${date}, ${p.weekday}, ${p.spirit}, ${p.seed}, ${JSON.stringify(p)})
      on conflict (play_date) do update
        set weekday = excluded.weekday,
            spirit  = excluded.spirit,
            seed    = excluded.seed,
            payload = excluded.payload`;
    written++;
    console.log(`✦ ${date}  ${p.rite} — ${p.spirit} (n=${p.n}, clues=${p.clues.length})`);
  }
  console.log(`\nSéance archive: ${written} day(s) written.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
