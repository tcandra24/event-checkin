"use server";

import { createClient } from "@/lib/supabase/server";
import { generateParticipantCode, normalizePhone } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface ParticipantFormInput {
  name: string;
  phone: string;
  seat_number: string;
  family_group: string;
  qty: number;
}

function validateInput(input: ParticipantFormInput): string | null {
  if (!input.name.trim()) return "Nama wajib diisi.";
  if (!input.phone.trim()) return "Nomor HP wajib diisi.";
  if (!input.seat_number.trim()) return "Nomor kursi wajib diisi.";
  if (!input.family_group.trim()) return "Keluarga/rombongan wajib diisi.";
  if (!Number.isFinite(input.qty) || input.qty < 1) {
    return "Jumlah pax (qty) minimal 1.";
  }
  return null;
}

export async function createParticipant(
  input: ParticipantFormInput
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Pastikan kode unik (retry jika ada bentrok, walau sangat kecil kemungkinannya)
  let code = generateParticipantCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateParticipantCode();
  }

  const { error } = await supabase.from("participants").insert({
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    seat_number: input.seat_number.trim(),
    family_group: input.family_group.trim(),
    qty: Math.round(input.qty),
    code,
    created_by: userData.user.id,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/peserta");
  revalidatePath("/laporan");
  return { success: true };
}

export async function updateParticipant(
  id: string,
  input: ParticipantFormInput
): Promise<ActionResult> {
  const supabase = await createClient();

  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { error } = await supabase
    .from("participants")
    .update({
      name: input.name.trim(),
      phone: normalizePhone(input.phone),
      seat_number: input.seat_number.trim(),
      family_group: input.family_group.trim(),
      qty: Math.round(input.qty),
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/peserta");
  revalidatePath("/laporan");
  return { success: true };
}

export async function deleteParticipant(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("participants").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/peserta");
  revalidatePath("/laporan");
  return { success: true };
}

export async function resetParticipantStatus(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("participants")
    .update({ status: "belum_hadir", checked_in_at: null })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/peserta");
  revalidatePath("/laporan");
  return { success: true };
}

export async function getFamilyGroups(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("participants")
    .select("family_group");

  if (!data) return [];
  const unique = Array.from(new Set(data.map((d) => d.family_group))).sort();
  return unique;
}
