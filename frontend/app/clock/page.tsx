import ClockGame from "@/components/ClockGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { pickRotating } from "@/lib/rng";

export const revalidate = 86400;

export default async function ClockPage() {
  const pool = await getQuestionsByType("year_guess");
  const rounds = pickRotating(pool, 5);

  return (
    <RoomShell label="room 02 — the clock" accent="music">
      <ClockGame rounds={rounds} pool={pool} />
    </RoomShell>
  );
}
