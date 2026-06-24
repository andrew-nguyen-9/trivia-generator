import { roomMetadata } from "@/lib/rooms";
import RoomShell from "@/components/RoomShell";
import LadderGame from "@/components/LadderGame";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 86400;

export const metadata = roomMetadata("/ladder");

export default async function LadderPage() {
  const pool = await getQuestionsByType("ladder");

  return (
    <RoomShell label="room 09 — climb of the initiate" accent="history">
      <LadderGame pool={pool} />
    </RoomShell>
  );
}
