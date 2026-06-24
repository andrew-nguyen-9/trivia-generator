import { roomMetadata } from "@/lib/rooms";
import DailyGame from "@/components/DailyGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed, pickRotating } from "@/lib/rng";
import type { Question } from "@/lib/types";

export const revalidate = 3600;

// PARLOR DAILY #1 = launch day
const EPOCH = Date.UTC(2026, 5, 12) / 86400000;

export const metadata = roomMetadata("/daily");

export default async function DailyPage() {
  const [mc, yr, hl, wh] = await Promise.all([
    getQuestionsByType("multiple_choice"),
    getQuestionsByType("year_guess"),
    getQuestionsByType("higher_lower"),
    getQuestionsByType("where"),
  ]);

  // date-seeded, no-repeat rotation → same gauntlet for everyone today, and a
  // fresh one tomorrow. Per-pool offsets keep these picks from colliding with
  // the standalone rooms (so The Daily never echoes today's Clock/Map).
  const day = daySeed();
  const mcs = pickRotating(mc, 2, day + 404);
  const rounds = [
    mcs[0],
    mcs[1],
    pickRotating(yr, 1, day + 101)[0],
    pickRotating(hl, 1, day + 202)[0],
    pickRotating(wh, 1, day + 303)[0],
  ].filter(Boolean) as Question[];
  const dailyNumber = day - EPOCH + 1;

  return (
    <RoomShell label="room 06 — the gauntlet" accent="wildcard">
      <DailyGame rounds={rounds} dailyNumber={dailyNumber} />
    </RoomShell>
  );
}
