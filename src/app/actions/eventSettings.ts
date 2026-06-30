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
  const { data } = await supabase.from("event_settings").select("*").eq("id", 1).maybeSingle();
  return (data as EventSettings) ?? null;
}

export async function updateEventSettings(input: { eventName: string; eventAddress: string }): Promise<ActionResult> {
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

export async function uploadTicketBackground(formData: FormData): Promise<ActionResult & { url?: string }> {
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

  if (file.size > 1 * 1024 * 1024) {
    return { success: false, error: "Ukuran gambar maksimal 1MB." };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `backgrounds/ticket-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from("ticket-assets").upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage.from("ticket-assets").getPublicUrl(path);

  const { error: updateError } = await supabase.from("event_settings").update({ ticket_background_url: publicUrlData.publicUrl }).eq("id", 1);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/pengaturan");
  revalidatePath("/peserta");
  return { success: true, url: publicUrlData.publicUrl };
}

export interface TicketBackgroundItem {
  path: string;
  url: string;
  uploadedAt: string | null;
}

/**
 * Mengambil daftar SEMUA gambar latar yang pernah diunggah (tersimpan di
 * folder backgrounds/ pada bucket ticket-assets), bukan cuma yang sedang
 * aktif dipakai. Setiap upload baru disimpan dengan nama file unik
 * (berbasis timestamp) dan TIDAK menimpa/menghapus file lama, sehingga
 * riwayat gambar sebelumnya tetap ada secara fisik di Storage — fungsi ini
 * menyediakan jalan untuk menampilkannya kembali di UI sebagai galeri,
 * supaya panitia bisa beralih ke gambar lama tanpa perlu upload ulang.
 */
export async function listTicketBackgrounds(): Promise<TicketBackgroundItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from("ticket-assets").list("backgrounds", {
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) return [];

  return data
    .filter((item) => item.name && !item.name.startsWith(".")) // abaikan placeholder folder
    .map((item) => {
      const path = `backgrounds/${item.name}`;
      const { data: publicUrlData } = supabase.storage.from("ticket-assets").getPublicUrl(path);
      return {
        path,
        url: publicUrlData.publicUrl,
        uploadedAt: item.created_at ?? null,
      };
    });
}

/**
 * Menjadikan salah satu gambar yang SUDAH ADA di Storage (dari riwayat
 * upload sebelumnya) sebagai latar tiket yang aktif, tanpa perlu
 * mengunggah ulang file apa pun. Dipakai saat panitia memilih gambar dari
 * galeri riwayat di halaman Pengaturan Tiket.
 */
export async function selectTicketBackground(url: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  const { error } = await supabase.from("event_settings").update({ ticket_background_url: url }).eq("id", 1);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/pengaturan");
  revalidatePath("/peserta");
  return { success: true };
}
