import { redirect } from "next/navigation";

// The Daily was reframed as The Gauntlet (2.12). Keep old /daily links alive.
export default function DailyPage() {
  redirect("/gauntlet");
}
