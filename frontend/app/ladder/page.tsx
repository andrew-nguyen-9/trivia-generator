import { roomMetadata } from "@/lib/rooms";
import RoomShell from "@/components/RoomShell";
import LadderGame from "@/components/LadderGame";
import { getLadderPuzzle } from "@/lib/queries";

export const metadata = roomMetadata("/ladder");

// `?date=YYYY-MM-DD` plays an archived past ascent. Default (today) is the live
// climb. Dynamic by design — no static seed fallback for this room.
export default async function LadderPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const valid = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const puzzle = await getLadderPuzzle(valid);

  return (
    <RoomShell label="room 09 — climb of the initiate" accent="history">
      <LadderGame puzzle={puzzle} requestedDate={valid ?? null} />
    </RoomShell>
  );
}
