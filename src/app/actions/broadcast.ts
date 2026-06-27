"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { waitUntil } from "@vercel/functions";

export interface BroadcastResult {
  success: boolean;
  error?: string;
  jobId?: string;
  totalRecipients?: number;
}

// "all" / "belum_hadir" / "hadir", atau nilai family_group spesifik (string bebas)
export type BroadcastFilter = string;

export interface BroadcastFailedItem {
  name: string;
  reason: string;
}

export interface BroadcastJobStatusResult {
  success: boolean;
  error?: string;
  status?: string;
  totalRecipients?: number;
  totalSuccess?: number;
  totalFailed?: number;
  totalPending?: number;
  failedItems?: BroadcastFailedItem[];
}

/**
 * Membuat job broadcast baru dan mendaftarkan seluruh penerima ke dalam
 * antrian (broadcast_job_items), TANPA langsung mengirim apa pun di sini.
 *
 * Sengaja dibuat secepat mungkin (cuma insert ke database) supaya tidak
 * kena timeout Server Action — pengiriman pesan yang sesungguhnya (dengan
 * jeda antar pesan) dilakukan terpisah oleh API Route /api/broadcast/process,
 * yang memproses job ini bertahap per-batch di background.
 */
export async function sendBroadcast(input: { message: string; filter: BroadcastFilter; includeQr: boolean }): Promise<BroadcastResult> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    return {
      success: false,
      error: "FONNTE_TOKEN belum diatur di environment variable. Tambahkan di .env.local.",
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

  let query = supabase.from("participants").select("id");
  if (input.filter === "belum_hadir" || input.filter === "hadir") {
    query = query.eq("status", input.filter);
  } else if (input.filter !== "all") {
    // filter berupa nama family_group spesifik
    query = query.eq("family_group", input.filter);
  }

  const { data: participants, error: fetchError } = await query;
  if (fetchError) {
    return { success: false, error: fetchError.message };
  }
  if (!participants || participants.length === 0) {
    return { success: false, error: "Tidak ada peserta yang cocok dengan filter ini." };
  }

  // 1. Buat header job
  const { data: job, error: jobError } = await supabase
    .from("broadcast_jobs")
    .insert({
      created_by: userData.user.id,
      message_template: input.message,
      target_filter: input.filter,
      include_qr: input.includeQr,
      total_recipients: participants.length,
      status: "queued",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { success: false, error: jobError?.message ?? "Gagal membuat job broadcast." };
  }

  // 2. Daftarkan setiap peserta sebagai item dalam job (semua "pending")
  const items = participants.map((p) => ({
    job_id: job.id,
    participant_id: p.id,
    status: "pending" as const,
  }));

  const { error: itemsError } = await supabase.from("broadcast_job_items").insert(items);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  // Picu pemrosesan batch pertama. Dibungkus waitUntil() (bukan asal
  // fetch tanpa await) supaya Vercel tidak memutus request ini di tengah
  // jalan sesaat setelah Server Action ini return ke UI — waitUntil()
  // menjamin promise ini benar-benar tuntas terkirim walau response sudah
  // balik ke pengguna lebih dulu (sehingga UI tetap responsif/cepat).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const secret = process.env.BROADCAST_PROCESS_SECRET;

  if (secret) {
    waitUntil(
      fetch(`${appUrl}/api/broadcast/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, secret }),
      }).catch(() => {
        // Diabaikan di sini — jika trigger awal ini tetap gagal terkirim,
        // job akan tetap berstatus "queued" dan akan dipulihkan oleh
        // Vercel Cron Job (/api/broadcast/cron) pada jadwal berikutnya.
      }),
    );
  }

  revalidatePath("/peserta");

  return {
    success: true,
    jobId: job.id,
    totalRecipients: participants.length,
  };
}

/**
 * Dipanggil berulang dari UI (polling) untuk menampilkan progres job yang
 * sedang berjalan di background.
 */
export async function getBroadcastJobStatus(jobId: string): Promise<BroadcastJobStatusResult> {
  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase.from("broadcast_jobs").select("*").eq("id", jobId).single();

  if (jobError || !job) {
    return { success: false, error: "Job broadcast tidak ditemukan." };
  }

  const { data: items, error: itemsError } = await supabase.from("broadcast_job_items").select("status, error_message, participant_id, participants(name)").eq("job_id", jobId);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  const totalSuccess = items?.filter((i) => i.status === "sent").length ?? 0;
  const totalFailed = items?.filter((i) => i.status === "failed").length ?? 0;
  const totalPending = items?.filter((i) => i.status === "pending").length ?? 0;
  const failedItems: BroadcastFailedItem[] =
    items
      ?.filter((i) => i.status === "failed")
      .map((i) => ({
        // @ts-expect-error -- relasi nested dari Supabase join, bentuknya objek tunggal saat foreign key many-to-one
        name: i.participants?.name ?? "Tidak diketahui",
        reason: i.error_message ?? "Alasan tidak tercatat",
      })) ?? [];

  return {
    success: true,
    status: job.status,
    totalRecipients: job.total_recipients,
    totalSuccess,
    totalFailed,
    totalPending,
    failedItems,
  };
}
