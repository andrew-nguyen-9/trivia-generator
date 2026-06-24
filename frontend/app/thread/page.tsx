import { roomMetadata } from "@/lib/rooms";
import RoomShell from "@/components/RoomShell";
import ThreadGame from "@/components/ThreadGame";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 86400;

export const metadata = roomMetadata("/thread");

export default async function ThreadPage() {
  // THE THREAD plays a forged daily chain (qtype: thread). The clue pool is a
  // fallback so the room is never empty before the thread recipe has run.
  const [threads, clues] = await Promise.all([
    getQuestionsByType("thread"),
    getQuestionsByType("clue"),
  ]);

  return (
    <RoomShell label="room 07 — thread of fate" accent="history">
      <ThreadGame threads={threads} clues={clues} />
    </RoomShell>
  );
}
