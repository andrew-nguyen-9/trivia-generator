import { roomMetadata } from "@/lib/rooms";
import AudioRoomGame from "@/components/AudioRoomGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed } from "@/lib/rng";

export const revalidate = 86400;

export const metadata = roomMetadata("/overture");

// §3.22 — The Overture ("Name the Intro"). audio_guess facts carry a synthesized
// intro melody (lib/sound.ts) + a source_url whose slug is the track title; the
// room (lib/overture.ts) derives titles and builds the name-the-tune choices.
// `daySeed` is computed server-side and passed down so the shared "daily intro"
// pick stays SSR/client-consistent (no Math.random in the render path).
export default async function OverturePage() {
  const pool = await getQuestionsByType("audio_guess");
  return (
    <RoomShell label="the overture — name the intro" accent="music">
      <AudioRoomGame pool={pool} daySeed={daySeed()} />
    </RoomShell>
  );
}
