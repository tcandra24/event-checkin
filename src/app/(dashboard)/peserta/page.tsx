import { createClient } from "@/lib/supabase/server";
import { ParticipantsClient } from "./ParticipantsClient";

export default async function ParticipantsPage() {
  const supabase = await createClient();
  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .order("created_at", { ascending: false });

  return <ParticipantsClient initialParticipants={participants ?? []} />;
}
