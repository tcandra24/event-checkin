"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Send, CheckCircle2, XCircle, Link2, Ticket, Clock, Ban } from "lucide-react";
import { sendBroadcast, getBroadcastJobStatus, cancelBroadcastJob, type BroadcastFilter, type BroadcastFailedItem } from "@/app/actions/broadcast";

type BroadcastMode = "rsvp" | "ticket";

const RSVP_TEMPLATE = `Halo {nama},

Anda diundang untuk menghadiri acara kami bersama {keluarga} (maks. {qty} orang).

Mohon konfirmasi kehadiranmu melalui tautan berikut:
{link_rsvp}

Terima kasih!`;

const TICKET_TEMPLATE = `Halo {nama},

Berikut tiket QR code kamu untuk menghadiri acara kami.
Kursi/Meja: {kursi}
Rombongan: {keluarga}
Berlaku untuk: {qty} orang

Mohon tunjukkan QR code terlampir saat tiba di lokasi untuk proses check-in. Sampai jumpa di acara!`;

// Seberapa sering UI menanyakan progres terbaru ke server (polling).
// Tidak perlu cepat — proses pengiriman aslinya berjalan dengan jeda
// beberapa detik per pesan, jadi 4 detik sudah cukup responsif.
const POLL_INTERVAL_MS = 4000;

interface JobProgress {
  status: string;
  totalRecipients: number;
  totalSuccess: number;
  totalFailed: number;
  totalPending: number;
  failedItems: BroadcastFailedItem[];
}

export function BroadcastModal({ onClose, familyOptions }: { onClose: () => void; familyOptions: string[] }) {
  const [mode, setMode] = useState<BroadcastMode>("rsvp");
  const [message, setMessage] = useState(RSVP_TEMPLATE);
  const [filter, setFilter] = useState<BroadcastFilter>("belum_hadir");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Polling status job selama masih berjalan (queued/processing)
  useEffect(() => {
    if (!jobId) return;
    if (progress?.status === "completed" || progress?.status === "failed" || progress?.status === "cancelled") return;

    const interval = setInterval(async () => {
      const res = await getBroadcastJobStatus(jobId);
      if (res.success) {
        setProgress({
          status: res.status ?? "processing",
          totalRecipients: res.totalRecipients ?? 0,
          totalSuccess: res.totalSuccess ?? 0,
          totalFailed: res.totalFailed ?? 0,
          totalPending: res.totalPending ?? 0,
          failedItems: res.failedItems ?? [],
        });
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [jobId, progress?.status]);

  function handleModeChange(newMode: BroadcastMode) {
    setMode(newMode);
    setMessage(newMode === "rsvp" ? RSVP_TEMPLATE : TICKET_TEMPLATE);
  }

  async function handleSend() {
    setSubmitting(true);
    setError(null);

    const res = await sendBroadcast({
      message,
      filter,
      includeQr: mode === "ticket",
    });
    setSubmitting(false);

    if (!res.success || !res.jobId) {
      setError(res.error ?? "Gagal memulai broadcast.");
      return;
    }

    setJobId(res.jobId);
    setProgress({
      status: "queued",
      totalRecipients: res.totalRecipients ?? 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalPending: res.totalRecipients ?? 0,
      failedItems: [],
    });
  }

  async function handleCancelBroadcast() {
    if (!jobId) return;
    setCancelling(true);
    const res = await cancelBroadcastJob(jobId);
    setCancelling(false);
    setShowCancelConfirm(false);

    if (res.success) {
      // Ambil status terbaru segera (tidak perlu menunggu polling interval
      // berikutnya) supaya UI langsung menampilkan status "dibatalkan".
      const statusRes = await getBroadcastJobStatus(jobId);
      if (statusRes.success) {
        setProgress({
          status: statusRes.status ?? "cancelled",
          totalRecipients: statusRes.totalRecipients ?? 0,
          totalSuccess: statusRes.totalSuccess ?? 0,
          totalFailed: statusRes.totalFailed ?? 0,
          totalPending: statusRes.totalPending ?? 0,
          failedItems: statusRes.failedItems ?? [],
        });
      }
    }
  }

  const isRunning = progress && (progress.status === "queued" || progress.status === "processing");
  const isDone = progress?.status === "completed";
  const isCancelled = progress?.status === "cancelled";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={isRunning ? undefined : onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl thin-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-(--color-border) px-6 py-4">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">Kirim Broadcast WhatsApp</h2>
          {!isRunning && (
            <button onClick={onClose} className="rounded-full p-1 text-(--color-slate) hover:bg-slate-100" aria-label="Tutup">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {progress ? (
          <div className="px-6 py-6">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isDone ? "bg-(--color-emerald-soft)" : isCancelled ? "bg-slate-100" : "bg-blue-50"}`}>
              {isDone ? <CheckCircle2 className="h-6 w-6 text-(--color-emerald)" /> : isCancelled ? <Ban className="h-6 w-6 text-(--color-slate)" /> : <Clock className="h-6 w-6 text-blue-600" />}
            </div>
            <h3 className="mt-3 font-display text-base font-semibold text-(--color-ink)">{isDone ? "Broadcast selesai" : isCancelled ? "Broadcast dibatalkan" : "Sedang mengirim secara bertahap..."}</h3>
            {isRunning && (
              <p className="mt-1 text-sm text-(--color-slate)">
                Pesan dikirim satu per satu dengan jeda antar pesan untuk menjaga keamanan nomor WhatsApp. Proses ini bisa berjalan beberapa menit hingga puluhan menit tergantung jumlah penerima — kamu boleh menutup halaman ini, broadcast tetap
                berlanjut di background.
              </p>
            )}
            {isCancelled && <p className="mt-1 text-sm text-(--color-slate)">Broadcast dihentikan sebelum semua penerima selesai diproses. Penerima yang sudah berhasil dikirimi pesan tetap tercatat di bawah ini.</p>}

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-(--color-emerald) transition-all"
                style={{
                  width: `${progress.totalRecipients > 0 ? Math.round(((progress.totalSuccess + progress.totalFailed) / progress.totalRecipients) * 100) : 0}%`,
                }}
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="font-display text-lg font-semibold text-(--color-ink)">{progress.totalRecipients}</p>
                <p className="text-xs text-(--color-slate)">Target</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="font-display text-lg font-semibold text-amber-700">{progress.totalPending}</p>
                <p className="text-xs text-amber-700">Menunggu</p>
              </div>
              <div className="rounded-lg bg-(--color-emerald-soft) p-3 text-center">
                <p className="font-display text-lg font-semibold text-emerald-700">{progress.totalSuccess}</p>
                <p className="text-xs text-emerald-700">Berhasil</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="font-display text-lg font-semibold text-red-700">{progress.totalFailed}</p>
                <p className="text-xs text-red-700">Gagal</p>
              </div>
            </div>

            {progress.failedItems.length > 0 && (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <XCircle className="h-4 w-4" />
                  {progress.failedItems.length} pesan gagal terkirim — detail error:
                </p>
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto thin-scrollbar">
                  {progress.failedItems.map((item, idx) => (
                    <li key={idx} className="rounded-md bg-white px-3 py-2 text-xs leading-relaxed">
                      <span className="font-semibold text-(--color-ink)">{item.name}</span>
                      <span className="mt-0.5 block text-red-600">{item.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isRunning && !showCancelConfirm && (
              <button onClick={() => setShowCancelConfirm(true)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                <Ban className="h-4 w-4" />
                Batalkan Broadcast
              </button>
            )}

            {showCancelConfirm && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Yakin ingin membatalkan broadcast ini?</p>
                <p className="mt-1 text-xs text-red-700">Penerima yang belum dikirimi pesan ({progress.totalPending} orang) tidak akan menerima broadcast ini sama sekali. Tindakan ini tidak bisa dibatalkan.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={cancelling}
                    className="flex-1 rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm font-semibold text-(--color-ink) hover:bg-slate-50 disabled:opacity-60"
                  >
                    Tidak, lanjutkan
                  </button>
                  <button onClick={handleCancelBroadcast} disabled={cancelling} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                    {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                    Ya, batalkan
                  </button>
                </div>
              </div>
            )}

            {(isDone || isCancelled) && (
              <button onClick={onClose} className="mt-6 w-full rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                Tutup
              </button>
            )}
          </div>
        ) : (
          <div className="px-6 py-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Jenis broadcast</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange("rsvp")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    mode === "rsvp" ? "border-(--color-ink) bg-(--color-ink) text-white" : "border-(--color-border) text-(--color-slate) hover:bg-slate-50"
                  }`}
                >
                  <Link2 className="h-4 w-4" />
                  RSVP (link konfirmasi)
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("ticket")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    mode === "ticket" ? "border-(--color-ink) bg-(--color-ink) text-white" : "border-(--color-border) text-(--color-slate) hover:bg-slate-50"
                  }`}
                >
                  <Ticket className="h-4 w-4" />
                  Tiket QR final
                </button>
              </div>
              <p className="mt-1.5 text-xs text-(--color-slate)">
                {mode === "rsvp" ? "Mengirim tautan agar peserta mengonfirmasi kehadiran sebelum tiket final dikirim." : "Mengirim gambar tiket QR code lengkap — gunakan setelah RSVP peserta disetujui."}
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Kirim ke</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none">
                <option value="all">Semua peserta</option>
                <option value="belum_hadir">Belum hadir saja</option>
                <option value="hadir">Sudah hadir saja</option>
                {familyOptions.length > 0 && (
                  <optgroup label="Per keluarga/rombongan">
                    {familyOptions.map((fg) => (
                      <option key={fg} value={fg}>
                        {fg}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Isi pesan</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className="w-full resize-none rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none" />
              <p className="mt-1.5 text-xs text-(--color-slate)">
                Placeholder yang tersedia: <code className="rounded bg-slate-100 px-1">{"{nama}"}</code> <code className="rounded bg-slate-100 px-1">{"{kursi}"}</code> <code className="rounded bg-slate-100 px-1">{"{keluarga}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1">{"{qty}"}</code> <code className="rounded bg-slate-100 px-1">{"{kode}"}</code> {mode === "rsvp" && <code className="rounded bg-slate-100 px-1">{"{link_rsvp}"}</code>}
              </p>
            </div>

            <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
              Pesan akan dikirim bertahap dengan jeda 3–8 detik secara acak antar penerima untuk menjaga keamanan nomor WhatsApp dari deteksi spam. Untuk banyak penerima, proses bisa berjalan cukup lama — kamu boleh menutup halaman ini, broadcast
              tetap berlanjut di background.
            </div>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

            <button onClick={handleSend} disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-(--color-emerald) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Memulai broadcast...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Kirim broadcast
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
