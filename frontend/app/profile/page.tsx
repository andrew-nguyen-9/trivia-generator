import ProfileDashboard from "@/components/ProfileDashboard";
import RoomShell from "@/components/RoomShell";

export default function ProfilePage() {
  return (
    <RoomShell label="the back office — your card" accent="wildcard">
      <ProfileDashboard />
    </RoomShell>
  );
}
