import ConnectionsGame from "@/components/ConnectionsGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 3600;

export default async function ConnectionsPage() {
  const puzzles = await getQuestionsByType("connections");
  return (
    <RoomShell label="room 10 — the connections" accent="wildcard">
      <ConnectionsGame puzzles={puzzles} />
    </RoomShell>
  );
}
