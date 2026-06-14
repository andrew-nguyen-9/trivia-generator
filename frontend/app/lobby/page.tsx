import { getQuestionsByType } from "@/lib/queries";
import { isSupabaseConfigured } from "@/lib/supabase";
import RoomShell from "@/components/RoomShell";
import LobbyGame from "@/components/LobbyGame";

export default async function LobbyPage() {
  const hasBackend = isSupabaseConfigured();
  // Pre-load the MC pool so the client has questions ready the moment a host
  // creates a room. In DB-less mode this resolves instantly from the seed bank.
  const pool = await getQuestionsByType("multiple_choice");
  return (
    <RoomShell label="The Lobby · multiplayer" accent="wildcard">
      <LobbyGame pool={pool} hasBackend={hasBackend} />
    </RoomShell>
  );
}
