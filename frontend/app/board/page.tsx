import { roomMetadata } from "@/lib/rooms";
import BoardGame from "@/components/BoardGame";
import RoomShell from "@/components/RoomShell";
import { buildBoardColumns, getQuestionsByType } from "@/lib/queries";
import { daySeed, mulberry32 } from "@/lib/rng";
import { pickTheme } from "@/lib/themes";

export const revalidate = 3600;

export const metadata = roomMetadata("/board");

export default async function BoardPage() {
  const clues = await getQuestionsByType("clue");
  const day = daySeed();
  const rand = mulberry32(day);
  const columns = buildBoardColumns(clues, (arr) => arr[Math.floor(rand() * arr.length)]);
  const dailyDouble: [number, number] = [
    Math.floor(rand() * columns.length),
    Math.floor(rand() * 5),
  ];
  const theme = pickTheme(day); // deterministic daily reskin (SSR/client agree)

  return (
    <RoomShell label={`room 01 — codex · ${theme.name.toLowerCase()}`} accent="history">
      <BoardGame columns={columns} dailyDouble={dailyDouble} clues={clues} theme={theme} />
    </RoomShell>
  );
}
