"use server";

import { createClient } from "@/lib/supabase/server";
import { generateParticipantCode, normalizePhone } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { ParticipantCategory } from "@/lib/types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createParticipant(input: {
  name: string;
  phone: string;
  company: string;
  category: ParticipantCategory;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  if (!input.name.trim() || !input.phone.trim()) {
    return { success: false, error: "Nama dan nomor HP wajib diisi." };
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
    company: input.company.trim() || null,
    category: input.category,
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
  input: {
    name: string;
    phone: string;
    company: string;
    category: ParticipantCategory;
  }
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!input.name.trim() || !input.phone.trim()) {
    return { success: false, error: "Nama dan nomor HP wajib diisi." };
  }

  const { error } = await supabase
    .from("participants")
    .update({
      name: input.name.trim(),
      phone: normalizePhone(input.phone),
      company: input.company.trim() || null,
      category: input.category,
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
