import RoomShell from "@/components/RoomShell";
import WeeklyCaseGame from "@/components/WeeklyCaseGame";
import { roomMetadata } from "@/lib/rooms";
import { daySeed } from "@/lib/rng";
import { weeklyBucket } from "@/lib/weeklyCase";

export const metadata = roomMetadata("/cold-case");

// Day-gated clues advance daily and the case rolls over weekly. ISR re-renders
// the server page so daySeed() (and the unlocked-day count) stay current without
// a redeploy — mirrors the daily rooms (/board).
export const revalidate = 3600;

// §3.23 — THE COLD CASE. Server resolves today's weekly bucket (which week's
// case, which day within it) and hands the pure numbers to the client game,
// which builds the case deterministically. No DB, no cross-room fetch.
export default function ColdCasePage() {
  const { weekSeed, dayIndex } = weeklyBucket(daySeed());
  return (
    <RoomShell label="The Cold Case" accent="history">
      <WeeklyCaseGame weekSeed={weekSeed} dayIndex={dayIndex} />
    </RoomShell>
  );
}
