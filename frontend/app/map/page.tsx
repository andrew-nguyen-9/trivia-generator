import { roomMetadata } from "@/lib/rooms";
import MapGame from "@/components/MapGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed, pickRotating } from "@/lib/rng";
import { civRounds, pickCivilization } from "@/lib/civilizations";

export const revalidate = 86400;

export const metadata = roomMetadata("/map");

export default async function MapPage() {
  const pool = await getQuestionsByType("where");

  // The day's ancient civilization opens the expedition: a "place this
  // civilization" pin-drop plus themed rounds (near history + far pop culture),
  // then a rotating tail of pinnable `where` facts. Deterministic by date so
  // SSR/client agree and everyone plays the same board (lib/rng.ts).
  const civ = pickCivilization(daySeed());
  const rounds = [...civRounds(civ), ...pickRotating(pool, 2)];

  return (
    <RoomShell label="room 05 — atlas obscura" accent="geography">
      <MapGame rounds={rounds} pool={pool} civ={civ} />
    </RoomShell>
  );
}
