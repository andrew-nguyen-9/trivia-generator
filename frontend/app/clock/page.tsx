import ClockGame from "@/components/ClockGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed, mulberry32, shuffled } from "@/lib/rng";

export const revalidate = 3600;

export default async function ClockPage() {
  const pool = await getQuestionsByType("year_guess");
  const rounds = shuffled(pool, mulberry32(daySeed())).slice(0, 5);

  return (
    <RoomShell label="room 02 — the clock" accent="music">
      <ClockGame rounds={rounds} pool={pool} />
    </RoomShell>
  );
}
