"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateTicketCard } from "@/lib/ticketCard";
import type { Participant } from "@/lib/types";

export interface BroadcastResult {
  success: boolean;
  error?: string;
  totalRecipients?: number;
  totalSuccess?: number;
  totalFailed?: number;
  failedNames?: string[];
}

// "all" / "belum_hadir" / "hadir", atau nilai family_group spesifik (string bebas)
export type BroadcastFilter = string;

const FONNTE_ENDPOINT_TEXT = "https://api.fonnte.com/send";

/**
 * Mengganti placeholder pada template pesan dengan data masing-masing peserta.
 * Placeholder yang didukung: {nama}, {kursi}, {keluarga}, {qty}, {kode}
 */
function renderMessage(template: string, p: Participant): string {
  return template
    .replaceAll("{nama}", p.name)
    .replaceAll("{kursi}", p.seat_number)
    .replaceAll("{keluarga}", p.family_group)
    .replaceAll("{qty}", String(p.qty))
    .replaceAll("{kode}", p.code);
}

async function sendOne(
  token: string,
  phone: string,
  message: string,
  imageBuffer?: Buffer
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (imageBuffer) {
      const form = new FormData();
      form.append("target", phone);
      form.append("message", message);
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });
      form.append("file", blob, "tiket.png");

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
  if (input.filter === "belum_hadir" || input.filter === "hadir") {
    query = query.eq("status", input.filter);
  } else if (input.filter !== "all") {
    // filter berupa nama family_group spesifik
    query = query.eq("family_group", input.filter);
  }

  const { data: participants, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }
  if (!participants || participants.length === 0) {
    return { success: false, error: "Tidak ada peserta yang cocok dengan filter ini." };
  }

  let settings: { event_name: string; event_address: string; ticket_background_url: string | null } | null = null;
  if (input.includeQr) {
    const { data } = await supabase
      .from("event_settings")
      .select("event_name, event_address, ticket_background_url")
      .eq("id", 1)
      .maybeSingle();
    settings = data;
  }

  let totalSuccess = 0;
  let totalFailed = 0;
  const failedNames: string[] = [];

  // Kirim berurutan dengan jeda singkat untuk menghindari rate-limit Fonnte.
  for (const p of participants as Participant[]) {
    const message = renderMessage(input.message, p);

    let imageBuffer: Buffer | undefined;
    if (input.includeQr) {
      try {
        imageBuffer = await generateTicketCard({
          participantName: p.name,
          code: p.code,
          qty: p.qty,
          eventName: settings?.event_name || "Nama Acara Anda",
          eventAddress: settings?.event_address || "",
          backgroundUrl: settings?.ticket_background_url || null,
        });
      } catch {
        imageBuffer = undefined;
      }
    }

    const result = await sendOne(token, p.phone, message, imageBuffer);

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
