import RoomShell from "@/components/RoomShell";
import WedgesGame from "@/components/WedgesGame";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 3600;

export default async function WedgesPage() {
  const pool = await getQuestionsByType("multiple_choice");

  return (
    <RoomShell label="room 03 — the wedges" accent="sports">
      <WedgesGame pool={pool} />
    </RoomShell>
  );
}
