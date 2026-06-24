import { roomMetadata } from "@/lib/rooms";
import GalleryGame from "@/components/GalleryGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";

export const revalidate = 3600;

export const metadata = roomMetadata("/gallery");

export default async function GalleryPage() {
  const pool = await getQuestionsByType("image_guess");
  return (
    <RoomShell label="room 08 — the gallery" accent="screen">
      <GalleryGame pool={pool} />
    </RoomShell>
  );
}
