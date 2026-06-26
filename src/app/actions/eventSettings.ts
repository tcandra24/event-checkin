"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { EventSettings } from "@/lib/types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function getEventSettings(): Promise<EventSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as EventSettings) ?? null;
}

export async function updateEventSettings(input: {
  eventName: string;
  eventAddress: string;
}): Promise<ActionResult> {
  const supabase = await createClient();

  if (!input.eventName.trim()) {
    return { success: false, error: "Nama acara wajib diisi." };
  }

  const { error } = await supabase
    .from("event_settings")
    .update({
      event_name: input.eventName.trim(),
      event_address: input.eventAddress.trim(),
    })
    .eq("id", 1);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/pengaturan");
  revalidatePath("/peserta");
  return { success: true };
}

export async function uploadTicketBackground(
  formData: FormData
): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "Tidak ada file yang diunggah." };
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: "Format gambar harus PNG, JPG, atau WEBP.",
    };
  }

  if (file.size > 8 * 1024 * 1024) {
    return { success: false, error: "Ukuran gambar maksimal 8MB." };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `backgrounds/ticket-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("ticket-assets")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage
    .from("ticket-assets")
    .getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("event_settings")
    .update({ ticket_background_url: publicUrlData.publicUrl })
    .eq("id", 1);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/pengaturan");
  revalidatePath("/peserta");
  return { success: true, url: publicUrlData.publicUrl };
}
