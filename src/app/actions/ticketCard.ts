"use server";

import { createClient } from "@/lib/supabase/server";
import { generateTicketCard } from "@/lib/ticketCard";

export interface TicketCardResult {
  success: boolean;
  error?: string;
  dataUrl?: string;
}

export async function generateTicketCardForParticipant(participantId: string): Promise<TicketCardResult> {
  const supabase = await createClient();

  const { data: participant, error: pError } = await supabase.from("participants").select("*").eq("id", participantId).single();

  if (pError || !participant) {
    return { success: false, error: "Peserta tidak ditemukan." };
  }

  const { data: settings } = await supabase.from("event_settings").select("*").eq("id", 1).maybeSingle();

  const buffer = await generateTicketCard({
    participantName: participant.name,
    code: participant.code,
    qty: participant.qty,
    rsvp_qty_response: participant.rsvp_qty_response,
    eventName: settings?.event_name || "Nama Acara Anda",
    eventAddress: settings?.event_address || "",
    backgroundUrl: settings?.ticket_background_url || null,
  });

  const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
  return { success: true, dataUrl };
}
