import RoomShell from "@/components/RoomShell";
import StreakGame from "@/components/StreakGame";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 3600;

export default async function StreakPage() {
  const pool = await getQuestionsByType("higher_lower");

  return (
    <RoomShell label="room 04 — the streak" accent="screen">
      <StreakGame pool={pool} />
    </RoomShell>
  );
}
