import MapGame from "@/components/MapGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed, mulberry32, shuffled } from "@/lib/rng";

export const revalidate = 3600;

export default async function MapPage() {
  const pool = await getQuestionsByType("where");
  const rounds = shuffled(pool, mulberry32(daySeed())).slice(0, 5);

  return (
    <RoomShell label="room 05 — the map" accent="geography">
      <MapGame rounds={rounds} />
    </RoomShell>
  );
}
