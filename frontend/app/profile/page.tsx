import { roomMetadata } from "@/lib/rooms";
import ProfileDashboard from "@/components/ProfileDashboard";
import RoomShell from "@/components/RoomShell";

export const metadata = roomMetadata("/profile");

export default function ProfilePage() {
  return (
    <RoomShell label="the back office — your card" accent="wildcard">
      <ProfileDashboard />
    </RoomShell>
  );
}
