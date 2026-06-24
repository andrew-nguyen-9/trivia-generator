import GauntletGame from "@/components/GauntletGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed, pickRotating } from "@/lib/rng";
import { roomMetadata } from "@/lib/rooms";
import type { Question } from "@/lib/types";

export const revalidate = 3600;

export const metadata = roomMetadata("/gauntlet");

// PARLOR GAUNTLET #1 = launch day
const EPOCH = Date.UTC(2026, 5, 12) / 86400000;

export default async function GauntletPage() {
  const [mc, yr, hl, wh] = await Promise.all([
    getQuestionsByType("multiple_choice"),
    getQuestionsByType("year_guess"),
    getQuestionsByType("higher_lower"),
    getQuestionsByType("where"),
  ]);

  // date-seeded, no-repeat rotation → the same temple for everyone today, a fresh
  // one tomorrow. Per-pool offsets keep these trials from echoing the standalone
  // rooms' picks for the day.
  const day = daySeed();
  const mcs = pickRotating(mc, 2, day + 404);
  const rounds = [
    mcs[0],
    mcs[1],
    pickRotating(yr, 1, day + 101)[0],
    pickRotating(hl, 1, day + 202)[0],
    pickRotating(wh, 1, day + 303)[0],
  ].filter(Boolean) as Question[];
  const gauntletNumber = day - EPOCH + 1;

  return (
    <RoomShell label="room 09 — the gauntlet" accent="wildcard">
      <GauntletGame rounds={rounds} gauntletNumber={gauntletNumber} />
    </RoomShell>
  );
}
