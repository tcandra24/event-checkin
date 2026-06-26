"use server";

import { createClient } from "@/lib/supabase/server";

export interface RsvpParticipantData {
  id: string;
  name: string;
  qty: number;
  family_group: string;
  rsvp_status: string;
  rsvp_qty_response: number | null;
}

export interface RsvpResult {
  success: boolean;
  error?: string;
}

/**
 * Mengambil data peserta untuk halaman RSVP publik berdasarkan kode tiket.
 * Memakai RPC (security definer) sehingga tidak perlu membuka akses SELECT
 * publik penuh ke tabel participants — hanya kolom yang relevan untuk RSVP
 * yang terekspos, dan hanya untuk 1 baris sesuai kode yang diberikan.
 */
export async function getParticipantForRsvp(
  code: string
): Promise<RsvpParticipantData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_participant_for_rsvp", {
    p_code: code.trim().toUpperCase(),
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0] as RsvpParticipantData;
}

/**
 * Submit konfirmasi kehadiran dari halaman publik. Memakai RPC yang
 * memvalidasi jumlah orang hadir tidak melebihi kapasitas (qty) tiket,
 * dan hanya mengubah kolom-kolom RSVP — tidak bisa menyentuh status
 * check-in atau data lain milik peserta.
 */
export async function submitRsvp(input: {
  code: string;
  attending: boolean;
  qtyResponse: number;
}): Promise<RsvpResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_code: input.code.trim().toUpperCase(),
    p_attending: input.attending,
    p_qty_response: input.attending ? input.qtyResponse : 0,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data?.[0];
  if (!result?.success) {
    return { success: false, error: result?.message ?? "Gagal menyimpan konfirmasi." };
  }

  return { success: true };
}
