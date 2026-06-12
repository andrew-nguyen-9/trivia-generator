import DailyGame from "@/components/DailyGame";
import RoomShell from "@/components/RoomShell";
import { getQuestionsByType } from "@/lib/queries";
import { daySeed, mulberry32, shuffled } from "@/lib/rng";
import type { Question } from "@/lib/types";

export const revalidate = 3600;

// PARLOR DAILY #1 = launch day
const EPOCH = Date.UTC(2026, 5, 12) / 86400000;

export default async function DailyPage() {
  const [mc, yr, hl, wh] = await Promise.all([
    getQuestionsByType("multiple_choice"),
    getQuestionsByType("year_guess"),
    getQuestionsByType("higher_lower"),
    getQuestionsByType("where"),
  ]);

  // date-seeded → the same gauntlet for everyone today
  const rand = mulberry32(daySeed() * 31 + 7);
  const mcs = shuffled(mc, rand);
  const rounds = [mcs[0], mcs[1], shuffled(yr, rand)[0], shuffled(hl, rand)[0], shuffled(wh, rand)[0]]
    .filter(Boolean) as Question[];
  const dailyNumber = daySeed() - EPOCH + 1;

  return (
    <RoomShell label="room 06 — the daily" accent="wildcard">
      <DailyGame rounds={rounds} dailyNumber={dailyNumber} />
    </RoomShell>
  );
}
