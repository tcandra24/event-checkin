import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Endpoint ini dipanggil otomatis oleh Vercel Cron (lihat konfigurasi
 * "crons" di vercel.json) setiap beberapa menit, untuk mendeteksi dan
 * memperbaiki job broadcast yang "macet" — yaitu job dengan status
 * `queued`/`processing` yang masih memiliki item `pending`, tapi tidak ada
 * aktivitas pengiriman (sent_at) dalam beberapa menit terakhir.
 *
 * Job bisa macet jika panggilan self-chaining di /api/broadcast/process
 * gagal terkirim (misal karena gangguan jaringan sesaat) — endpoint ini
 * berfungsi sebagai pengaman, BUKAN jalur utama pemrosesan broadcast.
 *
 * Vercel secara otomatis mengirim header "Authorization: Bearer <CRON_SECRET>"
 * pada setiap pemanggilan cron job, di mana CRON_SECRET adalah environment
 * variable yang kita tentukan sendiri (terpisah dari BROADCAST_PROCESS_SECRET
 * yang dipakai untuk self-chaining antar batch).
 */

export const maxDuration = 60;

// Job dianggap macet jika tidak ada aktivitas (sent_at terbaru) dalam
// rentang ini, TAPI masih ada item pending tersisa.
const STUCK_THRESHOLD_MINUTES = 5;

function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Memicu /api/broadcast/process untuk melanjutkan job tertentu. */
function triggerProcess(appUrl: string, jobId: string, secret: string) {
  return fetch(`${appUrl}/api/broadcast/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, secret }),
  });
}

export async function GET(req: NextRequest) {
  // Vercel Cron memanggil dengan method GET dan header Authorization
  // berisi CRON_SECRET yang kita set di Environment Variables.
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  if (!process.env.BROADCAST_PROCESS_SECRET) {
    return NextResponse.json({ error: "BROADCAST_PROCESS_SECRET belum diatur." }, { status: 500 });
  }

  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  // Ambil semua job yang masih berjalan (belum completed/failed/cancelled)
  const { data: activeJobs, error } = await supabase.from("broadcast_jobs").select("id, status, created_at").in("status", ["queued", "processing"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!activeJobs || activeJobs.length === 0) {
    return NextResponse.json({ message: "Tidak ada job aktif.", checked: 0, resumed: 0 });
  }

  const thresholdMs = STUCK_THRESHOLD_MINUTES * 60 * 1000;
  const now = Date.now();
  const resumedJobIds: string[] = [];

  for (const job of activeJobs) {
    // Pastikan job ini masih punya item pending — kalau tidak ada,
    // berarti job seharusnya sudah completed tapi gagal ditandai
    // (kasus langka), biarkan saja untuk pemeriksaan manual.
    const { count: pendingCount } = await supabase.from("broadcast_job_items").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("status", "pending");

    if (!pendingCount || pendingCount === 0) continue;

    // Cek aktivitas terakhir (item dengan sent_at paling baru) untuk job ini
    const { data: lastSentItem } = await supabase.from("broadcast_job_items").select("sent_at").eq("job_id", job.id).not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle();

    // Patokan waktu: aktivitas terakhir jika ada, kalau belum ada sama
    // sekali (job baru dibuat tapi belum pernah terproses) pakai created_at.
    const lastActivity = lastSentItem?.sent_at ? new Date(lastSentItem.sent_at).getTime() : new Date(job.created_at).getTime();

    const idleMs = now - lastActivity;

    if (idleMs > thresholdMs) {
      // Job ini macet — picu ulang prosesnya.
      try {
        await triggerProcess(appUrl, job.id, process.env.BROADCAST_PROCESS_SECRET);
        resumedJobIds.push(job.id);
      } catch {
        // Diabaikan — akan dicoba lagi di pemanggilan cron berikutnya.
      }
    }
  }

  return NextResponse.json({
    message: "Pemeriksaan selesai.",
    checked: activeJobs.length,
    resumed: resumedJobIds.length,
    resumedJobIds,
  });
}
