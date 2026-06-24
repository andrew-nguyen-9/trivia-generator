import { roomMetadata } from "@/lib/rooms";
import RoomShell from "@/components/RoomShell";
import SeanceGame from "@/components/SeanceGame";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 86400;

export const metadata = roomMetadata("/seance");

export default async function SeancePage() {
  const pool = await getQuestionsByType("seance");

  return (
    <RoomShell label="room 08 — the séance" accent="wildcard">
      <SeanceGame pool={pool} />
    </RoomShell>
  );
}
