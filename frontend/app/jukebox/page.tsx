import { roomMetadata } from "@/lib/rooms";
import JukeboxGame from "@/components/JukeboxGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 3600;

export const metadata = roomMetadata("/jukebox");

export default async function JukeboxPage() {
  const pool = await getQuestionsByType("audio_guess");
  return (
    <RoomShell label="room 07 — the jukebox" accent="music">
      <JukeboxGame pool={pool} />
    </RoomShell>
  );
}
