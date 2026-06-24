import { roomMetadata } from "@/lib/rooms";
import RoomShell from "@/components/RoomShell";
import SeanceGame from "@/components/SeanceGame";
import { getSeancePuzzle } from "@/lib/queries";

export const metadata = roomMetadata("/seance");

// `?date=YYYY-MM-DD` enables archive-play of a past night (reads that row from
// the Neon archive). The default (today) is the live séance. searchParams makes
// the route dynamic, which is correct: there is no static seed fallback here.
export default async function SeancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const valid = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const puzzle = await getSeancePuzzle(valid);

  return (
    <RoomShell label="room 08 — the séance" accent="wildcard">
      <SeanceGame puzzle={puzzle} requestedDate={valid ?? null} />
    </RoomShell>
  );
}
