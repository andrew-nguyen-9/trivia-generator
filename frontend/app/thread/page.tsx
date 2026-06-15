import RoomShell from "@/components/RoomShell";
import ThreadGame from "@/components/ThreadGame";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 86400;

export default async function ThreadPage() {
  const pool = await getQuestionsByType("clue");

  return (
    <RoomShell label="room 07 — the thread" accent="history">
      <ThreadGame pool={pool} />
    </RoomShell>
  );
}
