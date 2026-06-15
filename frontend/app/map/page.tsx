import MapGame from "@/components/MapGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { pickRotating } from "@/lib/rng";

export const revalidate = 86400;

export default async function MapPage() {
  const pool = await getQuestionsByType("where");
  const rounds = pickRotating(pool, 5);

  return (
    <RoomShell label="room 05 — the map" accent="geography">
      <MapGame rounds={rounds} pool={pool} />
    </RoomShell>
  );
}
