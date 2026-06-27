import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@supabase/supabase-js";
import { generateTicketCard } from "@/lib/ticketCard";
import type { Participant } from "@/lib/types";

// Endpoint ini dipanggil oleh Server Action sendBroadcast (sekali, untuk
// memulai job), dan oleh dirinya sendiri secara self-chaining (sampai
// semua item dalam job selesai diproses). Karena dipanggil sebagai HTTP
// request terpisah dari request awal pengguna, prosesnya TIDAK terikat
// pada batas waktu Server Action — masing-masing panggilan cukup memproses
// 1 batch kecil saja, lalu memicu panggilan berikutnya.
//
// Route ini sengaja dibuat sebagai Route Handler (bukan Server Action)
// karena perlu dipanggil dari server itu sendiri (fetch ke URL publiknya),
// yang lebih natural lewat HTTP endpoint biasa.

// Batas waktu maksimal 1 kali pemanggilan batch, dalam detik. PENTING:
// nilai ini harus konsisten dengan kombinasi batch_size & delay di tabel
// broadcast_jobs — pastikan (batch_size × rata-rata delay per pesan) +
// overhead request tetap berada SEDIKIT DI BAWAH nilai ini, atau batch
// berisiko terpotong paksa oleh Vercel di tengah proses (item yang belum
// sempat diupdate statusnya akan tertinggal di status "pending").
//
// Plan Vercel Hobby & Pro keduanya mendukung maxDuration hingga 60 detik
// untuk Serverless Functions biasa (App Router Route Handler) — namun
// tetap diberi sedikit margin di bawah limit untuk jaga-jaga.
export const maxDuration = 60;

const FONNTE_ENDPOINT = "https://api.fonnte.com/send";

// Pakai service role key di sini (BUKAN anon key) karena route ini dipicu
// oleh server-ke-server (bukan dari sesi browser pengguna yang login),
// sehingga tidak ada cookie sesi yang bisa dipakai createClient() biasa.
function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function renderMessage(template: string, p: Participant, appUrl: string): string {
  return template.replaceAll("{nama}", p.name).replaceAll("{kursi}", p.seat_number).replaceAll("{keluarga}", p.family_group).replaceAll("{qty}", String(p.qty)).replaceAll("{kode}", p.code).replaceAll("{link_rsvp}", `${appUrl}/rsvp/${p.code}`);
}

async function sendOne(token: string, phone: string, message: string, participantLabel: string, imageBuffer?: Buffer): Promise<{ ok: boolean; reason?: string }> {
  const logPrefix = `[broadcast] -> ${participantLabel} (${phone})`;

  try {
    if (imageBuffer) {
      const form = new FormData();
      form.append("target", phone);
      form.append("message", message);
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });
      form.append("file", blob, "tiket.png");

      console.log(`${logPrefix}: mengirim dengan lampiran gambar tiket...`);
      const res = await fetch(FONNTE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: token },
        body: form,
      });
      const rawText = await res.text();
      const json = (() => {
        try {
          return JSON.parse(rawText);
        } catch {
          return null;
        }
      })();

      console.log(`${logPrefix}: HTTP ${res.status}, response Fonnte: ${rawText.slice(0, 500)}`);

      if (!res.ok || json?.status === false) {
        const reason = json?.reason || `HTTP ${res.status}: ${rawText.slice(0, 200)}`;
        console.error(`${logPrefix}: GAGAL — ${reason}`);
        return { ok: false, reason };
      }
      console.log(`${logPrefix}: berhasil terkirim.`);
      return { ok: true };
    }

    console.log(`${logPrefix}: mengirim pesan teks...`);
    const res = await fetch(FONNTE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ target: phone, message }),
    });
    const rawText = await res.text();
    const json = (() => {
      try {
        return JSON.parse(rawText);
      } catch {
        return null;
      }
    })();

    console.log(`${logPrefix}: HTTP ${res.status}, response Fonnte: ${rawText.slice(0, 500)}`);

    if (!res.ok || json?.status === false) {
      const reason = json?.reason || `HTTP ${res.status}: ${rawText.slice(0, 200)}`;
      console.error(`${logPrefix}: GAGAL — ${reason}`);
      return { ok: false, reason };
    }
    console.log(`${logPrefix}: berhasil terkirim.`);
    return { ok: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Gagal mengirim (exception tidak dikenal)";
    console.error(`${logPrefix}: EXCEPTION — ${reason}`, e);
    return { ok: false, reason };
  }
}

/**
 * Memicu panggilan batch berikutnya. Mengembalikan promise-nya (bukan
 * fire-and-forget) supaya bisa dibungkus waitUntil() — ini penting di
 * Vercel: serverless function di sana dibekukan/dimatikan segera setelah
 * response dikirim, sehingga fetch() yang ditembak tanpa ditunggu berisiko
 * terputus di tengah jalan sebelum benar-benar terkirim ke server tujuan.
 * waitUntil() memberi tahu runtime Vercel untuk menunda penghentian function
 * sampai promise ini selesai, meski response sudah dikembalikan ke caller.
 */
async function triggerNextBatch(appUrl: string, jobId: string, secret: string) {
  try {
    await fetch(`${appUrl}/api/broadcast/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, secret }),
    });
  } catch {
    // Diabaikan di sini — jika trigger ini tetap gagal terkirim (misal
    // gangguan jaringan), job akan macet di status "processing" dan akan
    // dipulihkan oleh Vercel Cron Job (/api/broadcast/cron) pada
    // pemanggilan terjadwal berikutnya.
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const jobId = body?.jobId as string | undefined;
  const secret = body?.secret as string | undefined;

  console.log(`[broadcast] Menerima permintaan proses untuk job ${jobId ?? "(tidak ada jobId)"}`);

  // Proteksi sederhana supaya endpoint ini tidak bisa dipanggil sembarang
  // orang dari luar untuk memicu pengiriman pesan tanpa otorisasi.
  if (!process.env.BROADCAST_PROCESS_SECRET || secret !== process.env.BROADCAST_PROCESS_SECRET) {
    console.error("[broadcast] Permintaan ditolak: secret tidak cocok atau tidak diatur.");
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "jobId wajib diisi." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const token = process.env.FONNTE_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  if (!token) {
    console.error("[broadcast] FONNTE_TOKEN tidak diatur — job ditandai gagal.");
    await supabase.from("broadcast_jobs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", jobId);
    return NextResponse.json({ error: "FONNTE_TOKEN tidak diatur." }, { status: 500 });
  }

  const { data: job } = await supabase.from("broadcast_jobs").select("*").eq("id", jobId).single();

  if (!job) {
    console.error(`[broadcast] Job ${jobId} tidak ditemukan di database.`);
    return NextResponse.json({ error: "Job tidak ditemukan." }, { status: 404 });
  }

  console.log(`[broadcast] Job ${jobId} status saat ini: ${job.status} (total ${job.total_recipients} penerima)`);

  if (job.status === "completed" || job.status === "cancelled") {
    return NextResponse.json({ message: "Job sudah selesai/dibatalkan." });
  }

  // Tandai job mulai diproses (hanya berefek pada panggilan pertama)
  if (job.status === "queued") {
    await supabase.from("broadcast_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", jobId);
  }

  // Ambil event_settings sekali per batch, hanya jika job ini perlu kirim QR
  let settings: {
    event_name: string;
    event_address: string;
    ticket_background_url: string | null;
  } | null = null;
  if (job.include_qr) {
    const { data } = await supabase.from("event_settings").select("event_name, event_address, ticket_background_url").eq("id", 1).maybeSingle();
    settings = data;
  }

  // Ambil 1 batch item yang masih "pending"
  const { data: pendingItems } = await supabase.from("broadcast_job_items").select("id, participant_id, participants(*)").eq("job_id", jobId).eq("status", "pending").limit(job.batch_size);

  if (!pendingItems || pendingItems.length === 0) {
    console.log(`[broadcast] Job ${jobId}: tidak ada item pending lagi, menandai selesai.`);
    // Tidak ada lagi item pending → job selesai. Hitung ulang ringkasan akhir.
    const { count: successCount } = await supabase.from("broadcast_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "sent");

    const { count: failedCount } = await supabase.from("broadcast_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "failed");

    await supabase
      .from("broadcast_jobs")
      .update({
        status: "completed",
        total_success: successCount ?? 0,
        total_failed: failedCount ?? 0,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Catat juga ke broadcast_logs (riwayat ringkas, konsisten dengan versi lama)
    await supabase.from("broadcast_logs").insert({
      sent_by: job.created_by,
      message: job.message_template,
      target_filter: job.target_filter,
      total_recipients: job.total_recipients,
      total_success: successCount ?? 0,
      total_failed: failedCount ?? 0,
    });

    console.log(`[broadcast] Job ${jobId} SELESAI. Berhasil: ${successCount ?? 0}, Gagal: ${failedCount ?? 0}`);

    return NextResponse.json({ message: "Job selesai." });
  }

  // Proses batch ini SATU PER SATU dengan jeda acak antar pesan —
  // inilah bagian yang menghindarkan nomor WA dari deteksi spam.
  console.log(`[broadcast] Job ${jobId}: memproses batch berisi ${pendingItems.length} item...`);
  for (const item of pendingItems) {
    // @ts-expect-error -- relasi nested dari Supabase join (foreign key many-to-one ke participants)
    const participant = item.participants as Participant;

    if (!participant) {
      await supabase.from("broadcast_job_items").update({ status: "failed", error_message: "Data peserta tidak ditemukan" }).eq("id", item.id);
      continue;
    }

    const message = renderMessage(job.message_template, participant, appUrl);

    let imageBuffer: Buffer | undefined;
    if (job.include_qr) {
      try {
        imageBuffer = await generateTicketCard({
          participantName: participant.name,
          code: participant.code,
          qty: participant.qty,
          rsvp_qty_response: participant.rsvp_qty_response,
          eventName: settings?.event_name || "Nama Acara Anda",
          eventAddress: settings?.event_address || "",
          backgroundUrl: settings?.ticket_background_url || null,
        });
      } catch (e) {
        console.error(`[broadcast] Gagal generate tiket untuk ${participant.name} (${participant.code}):`, e);
        imageBuffer = undefined;
      }
    }

    const result = await sendOne(token, participant.phone, message, `${participant.name} [${participant.code}]`, imageBuffer);

    if (result.ok) {
      await supabase.from("broadcast_job_items").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", item.id);
      await supabase.from("participants").update({ wa_sent_at: new Date().toISOString(), wa_status: "sent" }).eq("id", participant.id);
    } else {
      await supabase
        .from("broadcast_job_items")
        .update({
          status: "failed",
          error_message: result.reason ?? "unknown",
          sent_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      await supabase
        .from("participants")
        .update({
          wa_sent_at: new Date().toISOString(),
          wa_status: `failed: ${result.reason ?? "unknown"}`,
        })
        .eq("id", participant.id);
    }

    // Jeda ACAK antar pesan (bukan tetap) — pola jeda yang persis sama
    // justru lebih mudah dikenali sebagai bot dibanding jeda manusiawi
    // yang bervariasi.
    const delay = randomDelay(job.delay_min_ms, job.delay_max_ms);
    console.log(`[broadcast] Menunggu ${delay}ms sebelum pesan berikutnya...`);
    await new Promise((r) => setTimeout(r, delay));
  }

  // Cek apakah masih ada item pending lain setelah batch ini —
  // jika ya, picu panggilan berikutnya (self-chaining).
  const { count: remainingCount } = await supabase.from("broadcast_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "pending");

  if (remainingCount && remainingCount > 0) {
    console.log(`[broadcast] Job ${jobId}: batch selesai, masih ada ${remainingCount} item pending. Memicu batch berikutnya...`);
    waitUntil(triggerNextBatch(appUrl, jobId, secret));
    return NextResponse.json({ message: "Batch selesai, melanjutkan batch berikutnya." });
  }

  // Tidak ada sisa item pending → tandai selesai (sama seperti blok di atas)
  const { count: successCount } = await supabase.from("broadcast_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "sent");

  const { count: failedCount } = await supabase.from("broadcast_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "failed");

  await supabase
    .from("broadcast_jobs")
    .update({
      status: "completed",
      total_success: successCount ?? 0,
      total_failed: failedCount ?? 0,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await supabase.from("broadcast_logs").insert({
    sent_by: job.created_by,
    message: job.message_template,
    target_filter: job.target_filter,
    total_recipients: job.total_recipients,
    total_success: successCount ?? 0,
    total_failed: failedCount ?? 0,
  });

  console.log(`[broadcast] Job ${jobId} SELESAI (tanpa batch lanjutan). Berhasil: ${successCount ?? 0}, Gagal: ${failedCount ?? 0}`);

  return NextResponse.json({ message: "Job selesai." });
}
