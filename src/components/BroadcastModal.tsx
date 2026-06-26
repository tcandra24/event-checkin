"use client";

import { useState } from "react";
import { Loader2, X, Send, CheckCircle2, XCircle, Link2, Ticket } from "lucide-react";
import { sendBroadcast, type BroadcastFilter } from "@/app/actions/broadcast";

type BroadcastMode = "rsvp" | "ticket";

const RSVP_TEMPLATE = `Halo {nama},

Anda diundang untuk menghadiri acara kami bersama {keluarga} (maks. {qty} orang).

Mohon konfirmasi kehadiranmu melalui tautan berikut:
{link_rsvp}

Terima kasih!`;

const TICKET_TEMPLATE = `Halo {nama},

Berikut tiket QR code kamu untuk menghadiri acara kami.
Nomor kursi: {kursi}
Rombongan: {keluarga}
Berlaku untuk: {qty} orang

Mohon tunjukkan QR code terlampir saat tiba di lokasi untuk proses check-in. Sampai jumpa di acara!`;

export function BroadcastModal({
  onClose,
  familyOptions,
}: {
  onClose: () => void;
  familyOptions: string[];
}) {
  const [mode, setMode] = useState<BroadcastMode>("rsvp");
  const [message, setMessage] = useState(RSVP_TEMPLATE);
  const [filter, setFilter] = useState<BroadcastFilter>("belum_hadir");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    totalRecipients: number;
    totalSuccess: number;
    totalFailed: number;
    failedNames: string[];
  } | null>(null);

  function handleModeChange(newMode: BroadcastMode) {
    setMode(newMode);
    setMessage(newMode === "rsvp" ? RSVP_TEMPLATE : TICKET_TEMPLATE);
  }

  async function handleSend() {
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await sendBroadcast({
      message,
      filter,
      includeQr: mode === "ticket",
    });
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
                Jenis broadcast
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange("rsvp")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    mode === "rsvp"
                      ? "border-(--color-ink) bg-(--color-ink) text-white"
                      : "border-(--color-border) text-(--color-slate) hover:bg-slate-50"
                  }`}
                >
                  <Link2 className="h-4 w-4" />
                  RSVP (link konfirmasi)
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("ticket")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    mode === "ticket"
                      ? "border-(--color-ink) bg-(--color-ink) text-white"
                      : "border-(--color-border) text-(--color-slate) hover:bg-slate-50"
                  }`}
                >
                  <Ticket className="h-4 w-4" />
                  Tiket QR final
                </button>
              </div>
              <p className="mt-1.5 text-xs text-(--color-slate)">
                {mode === "rsvp"
                  ? "Mengirim tautan agar peserta mengonfirmasi kehadiran sebelum tiket final dikirim."
                  : "Mengirim gambar tiket QR code lengkap — gunakan setelah RSVP peserta disetujui."}
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Kirim ke
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              >
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
                <code className="rounded bg-slate-100 px-1">{"{kursi}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1">{"{keluarga}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1">{"{qty}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1">{"{kode}"}</code>{" "}
                {mode === "rsvp" && (
                  <code className="rounded bg-slate-100 px-1">{"{link_rsvp}"}</code>
                )}
              </p>
            </div>

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
