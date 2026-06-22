"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Participant } from "@/lib/types";

export interface ScanResult {
  success: boolean;
  error?: string;
  alreadyCheckedIn?: boolean;
  participant?: Participant;
}

/**
 * Menerima isi QR code (bisa berupa code mentah "EVT-XXXXXXXX"
 * atau URL "https://domain.com/c/EVT-XXXXXXXX") lalu mengekstrak code-nya.
 */
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/EVT-[A-Z0-9]{6,10}/i);
  if (match) return match[0].toUpperCase();
  return trimmed.toUpperCase();
}

export async function checkInByCode(rawCode: string): Promise<ScanResult> {
  const supabase = await createClient();
  const code = extractCode(rawCode);

  const { data: participant, error: findError } = await supabase
    .from("participants")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (findError) {
    return { success: false, error: findError.message };
  }

  if (!participant) {
    return {
      success: false,
      error: "Kode QR tidak ditemukan dalam daftar peserta.",
    };
  }

  if (participant.status === "hadir") {
    return {
      success: true,
      alreadyCheckedIn: true,
      participant: participant as Participant,
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from("participants")
    .update({ status: "hadir", checked_in_at: new Date().toISOString() })
    .eq("id", participant.id)
    .select("*")
    .single();

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/laporan");
  revalidatePath("/peserta");

  return {
    success: true,
    alreadyCheckedIn: false,
    participant: updated as Participant,
  };
}
