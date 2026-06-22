"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import type { Participant } from "@/lib/types";

export interface BroadcastResult {
  success: boolean;
  error?: string;
  totalRecipients?: number;
  totalSuccess?: number;
  totalFailed?: number;
  failedNames?: string[];
}

export type BroadcastFilter = "all" | "VIP" | "Umum" | "belum_hadir" | "hadir";

const FONNTE_ENDPOINT_TEXT = "https://api.fonnte.com/send";

/**
 * Mengganti placeholder pada template pesan dengan data masing-masing peserta.
 * Placeholder yang didukung: {nama}, {instansi}, {kategori}, {kode}
 */
function renderMessage(template: string, p: Participant): string {
  return template
    .replaceAll("{nama}", p.name)
    .replaceAll("{instansi}", p.company || "-")
    .replaceAll("{kategori}", p.category)
    .replaceAll("{kode}", p.code);
}

async function sendOne(
  token: string,
  phone: string,
  message: string,
  qrDataUrl?: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (qrDataUrl) {
      // Fonnte mendukung pengiriman gambar lewat field "file" berupa base64 atau URL.
      // Untuk base64, Fonnte mensyaratkan data URL (data:image/png;base64,...).
      const form = new FormData();
      form.append("target", phone);
      form.append("message", message);
      form.append("file", qrDataUrl);

      const res = await fetch(FONNTE_ENDPOINT_TEXT, {
        method: "POST",
        headers: { Authorization: token },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.status === false) {
        return { ok: false, reason: json?.reason || `HTTP ${res.status}` };
      }
      return { ok: true };
    }

    const res = await fetch(FONNTE_ENDPOINT_TEXT, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ target: phone, message }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.status === false) {
      return { ok: false, reason: json?.reason || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Gagal mengirim" };
  }
}

export async function sendBroadcast(input: {
  message: string;
  filter: BroadcastFilter;
  includeQr: boolean;
}): Promise<BroadcastResult> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    return {
      success: false,
      error:
        "FONNTE_TOKEN belum diatur di environment variable. Tambahkan di .env.local.",
    };
  }

  if (!input.message.trim()) {
    return { success: false, error: "Isi pesan tidak boleh kosong." };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  let query = supabase.from("participants").select("*");
  if (input.filter === "VIP" || input.filter === "Umum") {
    query = query.eq("category", input.filter);
  } else if (input.filter === "belum_hadir" || input.filter === "hadir") {
    query = query.eq("status", input.filter);
  }

  const { data: participants, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  if (!participants || participants.length === 0) {
    return { success: false, error: "Tidak ada peserta yang cocok dengan filter ini." };
  }

  let totalSuccess = 0;
  let totalFailed = 0;
  const failedNames: string[] = [];

  // Kirim berurutan dengan jeda singkat untuk menghindari rate-limit Fonnte.
  for (const p of participants as Participant[]) {
    const message = renderMessage(input.message, p);

    let qrDataUrl: string | undefined;
    if (input.includeQr) {
      qrDataUrl = await QRCode.toDataURL(p.code, { width: 480, margin: 1 });
    }

    const result = await sendOne(token, p.phone, message, qrDataUrl);

    if (result.ok) {
      totalSuccess++;
      await supabase
        .from("participants")
        .update({ wa_sent_at: new Date().toISOString(), wa_status: "sent" })
        .eq("id", p.id);
    } else {
      totalFailed++;
      failedNames.push(p.name);
      await supabase
        .from("participants")
        .update({
          wa_sent_at: new Date().toISOString(),
          wa_status: `failed: ${result.reason ?? "unknown"}`,
        })
        .eq("id", p.id);
    }

    // jeda kecil antar pengiriman
    await new Promise((r) => setTimeout(r, 350));
  }

  await supabase.from("broadcast_logs").insert({
    sent_by: userData.user.id,
    message: input.message,
    target_filter: input.filter,
    total_recipients: participants.length,
    total_success: totalSuccess,
    total_failed: totalFailed,
  });

  revalidatePath("/peserta");

  return {
    success: true,
    totalRecipients: participants.length,
    totalSuccess,
    totalFailed,
    failedNames,
  };
}
