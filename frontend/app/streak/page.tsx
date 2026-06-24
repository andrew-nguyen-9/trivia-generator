import { roomMetadata } from "@/lib/rooms";
import RoomShell from "@/components/RoomShell";
import StreakGame from "@/components/StreakGame";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 3600;

export const metadata = roomMetadata("/streak");

export default async function StreakPage() {
  const pool = await getQuestionsByType("higher_lower");

  return (
    <RoomShell label="room 04 — ignite" accent="screen">
      <StreakGame pool={pool} />
    </RoomShell>
  );
}
