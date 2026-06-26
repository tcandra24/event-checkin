"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Menyetujui RSVP peserta. Panitia bisa menyesuaikan jumlah final yang hadir
 * (misalnya peserta bilang akan datang 3 orang, tapi panitia menyamakan ke
 * data lain) — defaultnya memakai rsvp_qty_response yang diisi peserta.
 */
export async function approveRsvp(
  participantId: string,
  finalQty?: number
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  const { data: participant, error: fetchError } = await supabase
    .from("participants")
    .select("rsvp_qty_response, qty")
    .eq("id", participantId)
    .single();

  if (fetchError || !participant) {
    return { success: false, error: "Peserta tidak ditemukan." };
  }

  const qtyToApply = finalQty ?? participant.rsvp_qty_response ?? participant.qty;

  if (qtyToApply < 1 || qtyToApply > participant.qty) {
    return {
      success: false,
      error: `Jumlah final harus antara 1 dan ${participant.qty} (kapasitas tiket).`,
    };
  }

  const { error } = await supabase
    .from("participants")
    .update({
      rsvp_status: "dikonfirmasi_hadir",
      rsvp_qty_response: qtyToApply,
      rsvp_reviewed_by: userData.user.id,
      rsvp_reviewed_at: new Date().toISOString(),
    })
    .eq("id", participantId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/peserta");
  revalidatePath("/laporan");
  return { success: true };
}

export async function rejectRsvp(participantId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  const { error } = await supabase
    .from("participants")
    .update({
      rsvp_status: "dikonfirmasi_tidak_hadir",
      rsvp_reviewed_by: userData.user.id,
      rsvp_reviewed_at: new Date().toISOString(),
    })
    .eq("id", participantId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/peserta");
  revalidatePath("/laporan");
  return { success: true };
}

/** Mengembalikan status RSVP peserta ke "belum_konfirmasi" (misal untuk re-kirim link). */
export async function resetRsvp(participantId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("participants")
    .update({
      rsvp_status: "belum_konfirmasi",
      rsvp_qty_response: null,
      rsvp_responded_at: null,
      rsvp_reviewed_by: null,
      rsvp_reviewed_at: null,
    })
    .eq("id", participantId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/peserta");
  revalidatePath("/laporan");
  return { success: true };
}
