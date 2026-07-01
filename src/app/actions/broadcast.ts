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
 * Membatalkan job broadcast yang sedang berjalan (status queued/processing).
 * Tidak langsung menghentikan proses background yang sedang berjalan saat
 * itu juga (proses berjalan sebagai panggilan HTTP terpisah yang sudah
 * berjalan), tapi MENANDAI agar batch berikutnya yang dipicu — bahkan item
 * berikutnya DALAM batch yang sedang berjalan — tidak lagi diproses, begitu
 * /api/broadcast/process membaca status job ini di pemeriksaan berikutnya.
 */
export async function cancelBroadcastJob(jobId: string): Promise<BroadcastResult> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  const { data: job, error: fetchError } = await supabase.from("broadcast_jobs").select("status").eq("id", jobId).single();

  if (fetchError || !job) {
    return { success: false, error: "Job broadcast tidak ditemukan." };
  }

  if (job.status === "completed" || job.status === "cancelled" || job.status === "failed") {
    return {
      success: false,
      error: "Broadcast ini sudah tidak berjalan, tidak bisa dibatalkan.",
    };
  }

  const { error } = await supabase.from("broadcast_jobs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", jobId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Catat juga ke broadcast_logs (riwayat ringkas) supaya tetap terlihat
  // di halaman Riwayat Broadcast walau dibatalkan di tengah jalan — hitung
  // berapa yang sempat terkirim/gagal sebelum dibatalkan.
  const { count: successCount } = await supabase.from("broadcast_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "sent");

  const { count: failedCount } = await supabase.from("broadcast_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "failed");

  const { data: jobDetail } = await supabase.from("broadcast_jobs").select("created_by, message_template, target_filter, total_recipients").eq("id", jobId).single();

  if (jobDetail) {
    await supabase.from("broadcast_logs").insert({
      sent_by: jobDetail.created_by,
      message: `[DIBATALKAN] ${jobDetail.message_template}`,
      target_filter: jobDetail.target_filter,
      total_recipients: jobDetail.total_recipients,
      total_success: successCount ?? 0,
      total_failed: failedCount ?? 0,
    });
  }

  revalidatePath("/peserta");
  revalidatePath("/riwayat-broadcast");
  return { success: true };
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

export interface BroadcastLogItem {
  id: string;
  sentBy: string | null;
  message: string;
  targetFilter: string;
  totalRecipients: number;
  totalSuccess: number;
  totalFailed: number;
  createdAt: string;
  wasCancelled: boolean;
}

/**
 * Mengambil riwayat seluruh broadcast yang pernah dikirim (termasuk yang
 * dibatalkan di tengah jalan), diurutkan dari yang terbaru. Sumber datanya
 * tabel broadcast_logs — diisi otomatis setiap kali sebuah broadcast job
 * selesai (baik tuntas maupun dibatalkan), lihat akhir fungsi
 * cancelBroadcastJob() dan endpoint /api/broadcast/process.
 */
export async function getBroadcastHistory(): Promise<BroadcastLogItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("broadcast_logs").select("*").order("created_at", { ascending: false }).limit(200);

  if (error || !data) return [];

  return data.map((log) => ({
    id: log.id,
    sentBy: log.sent_by,
    message: log.message.replace(/^\[DIBATALKAN\] /, ""),
    targetFilter: log.target_filter,
    totalRecipients: log.total_recipients,
    totalSuccess: log.total_success,
    totalFailed: log.total_failed,
    createdAt: log.created_at,
    wasCancelled: log.message.startsWith("[DIBATALKAN] "),
  }));
}
