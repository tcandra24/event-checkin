import { getParticipantForRsvp } from "@/app/actions/rsvpPublic";
import { RsvpClient } from "./RsvpClient";
import { createClient } from "@/lib/supabase/server";

export default async function RsvpPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const participant = await getParticipantForRsvp(code);

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("event_settings")
    .select("event_name, event_address")
    .eq("id", 1)
    .maybeSingle();

  return (
    <RsvpClient
      code={code}
      participant={participant}
      eventName={settings?.event_name ?? "Acara"}
      eventAddress={settings?.event_address ?? ""}
    />
  );
}
