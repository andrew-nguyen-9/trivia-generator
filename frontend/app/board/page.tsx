import BoardGame from "@/components/BoardGame";
import RoomShell from "@/components/RoomShell";
import { buildBoardColumns, getQuestionsByType } from "@/lib/queries";
import { daySeed, mulberry32 } from "@/lib/rng";

export const revalidate = 3600;

export default async function BoardPage() {
  const clues = await getQuestionsByType("clue");
  const rand = mulberry32(daySeed());
  const columns = buildBoardColumns(clues, (arr) => arr[Math.floor(rand() * arr.length)]);
  const dailyDouble: [number, number] = [
    Math.floor(rand() * columns.length),
    Math.floor(rand() * 5),
  ];

  return (
    <RoomShell label="room 01 — the board" accent="history">
      <BoardGame columns={columns} dailyDouble={dailyDouble} clues={clues} />
    </RoomShell>
  );
}
