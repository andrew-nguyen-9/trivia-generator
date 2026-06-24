import { roomMetadata } from "@/lib/rooms";
import RoomShell from "@/components/RoomShell";
import WedgesGame from "@/components/WedgesGame";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed } from "@/lib/rng";

export const revalidate = 3600;

export const metadata = roomMetadata("/wedges");

export default async function WedgesPage() {
  const pool = await getQuestionsByType("multiple_choice");
  // Seed the shared daily order on the server so SSR and client agree and every
  // player on this date faces the same questions per category in the same order.
  const day = daySeed();

  return (
    <RoomShell label="room 03 — fractures" accent="sports">
      <WedgesGame pool={pool} day={day} />
    </RoomShell>
  );
}
