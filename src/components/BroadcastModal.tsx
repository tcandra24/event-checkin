"use client";

import { useState } from "react";
import { Loader2, X, Send, CheckCircle2, XCircle } from "lucide-react";
import { sendBroadcast, type BroadcastFilter } from "@/app/actions/broadcast";

const FILTER_OPTIONS: { value: BroadcastFilter; label: string }[] = [
  { value: "all", label: "Semua peserta" },
  { value: "belum_hadir", label: "Belum hadir saja" },
  { value: "hadir", label: "Sudah hadir saja" },
  { value: "VIP", label: "Kategori VIP" },
  { value: "Umum", label: "Kategori Umum" },
];

const DEFAULT_TEMPLATE = `Halo {nama},

Anda mengundang untuk menghadiri *${process.env.NEXT_PUBLIC_EVENT_NAME || "acara kami"}*.

🗓️ ${process.env.NEXT_PUBLIC_EVENT_DATE || "[tanggal acara]"}
📍 ${process.env.NEXT_PUBLIC_EVENT_LOCATION || "[lokasi acara]"}

Mohon tunjukkan QR code terlampir saat tiba di lokasi untuk proses check-in. Sampai jumpa di acara!`;

export function BroadcastModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState(DEFAULT_TEMPLATE);
  const [filter, setFilter] = useState<BroadcastFilter>("belum_hadir");
  const [includeQr, setIncludeQr] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    totalRecipients: number;
    totalSuccess: number;
    totalFailed: number;
    failedNames: string[];
  } | null>(null);

  async function handleSend() {
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await sendBroadcast({ message, filter, includeQr });
    setLoading(false);

    if (!res.success) {
      setError(res.error ?? "Gagal mengirim broadcast.");
      return;
    }

    setResult({
      totalRecipients: res.totalRecipients ?? 0,
      totalSuccess: res.totalSuccess ?? 0,
      totalFailed: res.totalFailed ?? 0,
      failedNames: res.failedNames ?? [],
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl thin-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-(--color-border) px-6 py-4">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">
            Kirim Broadcast WhatsApp
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-(--color-slate) hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          <div className="px-6 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-emerald-soft)">
              <CheckCircle2 className="h-6 w-6 text-(--color-emerald)" />
            </div>
            <h3 className="mt-3 font-display text-base font-semibold text-(--color-ink)">
              Broadcast terkirim
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="font-display text-lg font-semibold text-(--color-ink)">
                  {result.totalRecipients}
                </p>
                <p className="text-xs text-(--color-slate)">Target</p>
              </div>
              <div className="rounded-lg bg-(--color-emerald-soft) p-3 text-center">
                <p className="font-display text-lg font-semibold text-emerald-700">
                  {result.totalSuccess}
                </p>
                <p className="text-xs text-emerald-700">Berhasil</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="font-display text-lg font-semibold text-red-700">
                  {result.totalFailed}
                </p>
                <p className="text-xs text-red-700">Gagal</p>
              </div>
            </div>

            {result.failedNames.length > 0 && (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <XCircle className="h-4 w-4" /> Gagal terkirim ke:
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {result.failedNames.join(", ")}
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Tutup
            </button>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Kirim ke
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as BroadcastFilter)}
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              >
                {FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Isi pesan
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-(--color-slate)">
                Placeholder yang tersedia:{" "}
                <code className="rounded bg-slate-100 px-1">{"{nama}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1">{"{instansi}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1">{"{kategori}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1">{"{kode}"}</code>
              </p>
            </div>

            <label className="mt-4 flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={includeQr}
                onChange={(e) => setIncludeQr(e.target.checked)}
                className="h-4 w-4 rounded border-(--color-border)"
              />
              <span className="text-sm text-(--color-ink)">
                Lampirkan gambar QR code pribadi setiap peserta
              </span>
            </label>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              onClick={handleSend}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-(--color-emerald) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Mengirim, jangan tutup halaman...
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
