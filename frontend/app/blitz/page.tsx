import BlitzGame from "@/components/BlitzGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 3600;

export default async function BlitzPage() {
  const pool = await getQuestionsByType("multiple_choice");
  return (
    <RoomShell label="room 09 — the blitz" accent="history">
      <BlitzGame pool={pool} />
    </RoomShell>
  );
}
