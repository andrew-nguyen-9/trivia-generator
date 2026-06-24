import ClockGame from "@/components/ClockGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed, pickRotating } from "@/lib/rng";
import { pickCalendar } from "@/lib/calendars";

export const revalidate = 86400;

export default async function ClockPage() {
  const day = daySeed();
  // year_guess facts drive the dial; audio_guess facts fold in the Jukebox
  // "when was this released" round (audio via lib/sound.ts, no asset files).
  const [years, audio] = await Promise.all([
    getQuestionsByType("year_guess"),
    getQuestionsByType("audio_guess"),
  ]);
  const audioYears = audio.filter((q) => typeof q.year === "number");
  const pool = [...years, ...audioYears];
  const rounds = pickRotating(pool, 5, day);
  const calendar = pickCalendar(day); // deterministic daily twist (SSR/client agree)

  return (
    <RoomShell label={`room 02 — the clock · ${calendar.name.toLowerCase()}`} accent="music">
      <ClockGame rounds={rounds} pool={pool} calendar={calendar} daySeed={day} />
    </RoomShell>
  );
}
