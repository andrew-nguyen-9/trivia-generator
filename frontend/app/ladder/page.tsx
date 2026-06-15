import RoomShell from "@/components/RoomShell";
import LadderGame from "@/components/LadderGame";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 86400;

export default async function LadderPage() {
  const pool = await getQuestionsByType("ladder");

  return (
    <RoomShell label="room 09 — the ladder" accent="history">
      <LadderGame pool={pool} />
    </RoomShell>
  );
}
