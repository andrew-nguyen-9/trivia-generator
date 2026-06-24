import { roomMetadata } from "@/lib/rooms";
import RoomShell from "@/components/RoomShell";
import MysteryGame from "@/components/MysteryGame";
import { generateCase, todayISO } from "@/lib/mystery";

// One handcrafted-feeling case per night, regenerated deterministically from the
// date — no backend, no tokens. Revalidate daily so "today's case" rolls over.
export const revalidate = 86400;

export const metadata = roomMetadata("/mystery");

export default function MysteryPage() {
  const today = todayISO();
  const mystery = generateCase(today);

  return (
    <RoomShell label="room 10 — sanctum mysterii" accent="history">
      <MysteryGame mystery={mystery} />
    </RoomShell>
  );
}
