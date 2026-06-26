"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Minus,
  Plus,
  CalendarHeart,
  Clock,
} from "lucide-react";
import { submitRsvp, type RsvpParticipantData } from "@/app/actions/rsvpPublic";

export function RsvpClient({
  code,
  participant,
  eventName,
  eventAddress,
}: {
  code: string;
  participant: RsvpParticipantData | null;
  eventName: string;
  eventAddress: string;
}) {
  const [submitted, setSubmitted] = useState<{
    attending: boolean;
    qty: number;
  } | null>(null);
  const [qty, setQty] = useState(participant?.qty ?? 1);
  const [loading, setLoading] = useState<"hadir" | "tidak" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"choice" | "qty">("choice");

  if (!participant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--color-canvas-soft) px-4">
        <div className="w-full max-w-sm rounded-2xl border border-(--color-border) bg-white p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 font-display text-lg font-semibold text-(--color-ink)">
            Tautan tidak valid
          </h1>
          <p className="mt-2 text-sm text-(--color-slate)">
            Kode undangan tidak ditemukan. Periksa kembali tautan yang kamu
            terima, atau hubungi panitia acara.
          </p>
        </div>
      </div>
    );
  }

  const alreadyResponded =
    participant.rsvp_status !== "belum_konfirmasi" && !submitted;

  async function handleAttending() {
    setStep("qty");
  }

  async function handleConfirmAttending() {
    setLoading("hadir");
    setError(null);
    const result = await submitRsvp({ code, attending: true, qtyResponse: qty });
    setLoading(null);

    if (!result.success) {
      setError(result.error ?? "Gagal mengirim konfirmasi, coba lagi.");
      return;
    }
    setSubmitted({ attending: true, qty });
  }

  async function handleNotAttending() {
    setLoading("tidak");
    setError(null);
    const result = await submitRsvp({ code, attending: false, qtyResponse: 0 });
    setLoading(null);

    if (!result.success) {
      setError(result.error ?? "Gagal mengirim konfirmasi, coba lagi.");
      return;
    }
    setSubmitted({ attending: false, qty: 0 });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-canvas-soft) px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-(--color-ink)">
            <CalendarHeart className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-lg font-semibold text-(--color-ink)">
            {eventName}
          </h1>
          {eventAddress && (
            <p className="mt-1 text-sm text-(--color-slate)">{eventAddress}</p>
          )}
        </div>

        <div className="rounded-2xl border border-(--color-border) bg-white p-6 shadow-sm">
          {submitted ? (
            <div className="text-center">
              {submitted.attending ? (
                <>
                  <CheckCircle2 className="mx-auto h-10 w-10 text-(--color-emerald)" />
                  <h2 className="mt-3 font-display text-base font-semibold text-(--color-ink)">
                    Terima kasih, {participant.name}!
                  </h2>
                  <p className="mt-2 text-sm text-(--color-slate)">
                    Konfirmasi kehadiran untuk{" "}
                    <span className="font-semibold text-(--color-ink)">
                      {submitted.qty} orang
                    </span>{" "}
                    telah kami terima. Tim panitia akan meninjau konfirmasi ini
                    sebelum mengirimkan tiket QR final.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="mx-auto h-10 w-10 text-(--color-slate)" />
                  <h2 className="mt-3 font-display text-base font-semibold text-(--color-ink)">
                    Terima kasih atas konfirmasinya
                  </h2>
                  <p className="mt-2 text-sm text-(--color-slate)">
                    Kami mencatat bahwa {participant.name} tidak dapat hadir
                    pada acara ini. Sampai jumpa di kesempatan lain!
                  </p>
                </>
              )}
            </div>
          ) : alreadyResponded ? (
            <div className="text-center">
              <Clock className="mx-auto h-10 w-10 text-(--color-amber)" />
              <h2 className="mt-3 font-display text-base font-semibold text-(--color-ink)">
                Konfirmasi sudah tercatat
              </h2>
              <p className="mt-2 text-sm text-(--color-slate)">
                {participant.rsvp_status === "menunggu_approval" &&
                  `Kami sudah menerima konfirmasi hadir untuk ${participant.rsvp_qty_response} orang dan sedang menunggu peninjauan panitia.`}
                {participant.rsvp_status === "dikonfirmasi_hadir" &&
                  `Kehadiranmu untuk ${participant.rsvp_qty_response} orang sudah dikonfirmasi panitia. Sampai jumpa di acara!`}
                {participant.rsvp_status === "dikonfirmasi_tidak_hadir" &&
                  "Kamu telah mengonfirmasi tidak dapat hadir pada acara ini."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-(--color-slate)">Halo,</p>
              <h2 className="mt-0.5 font-display text-xl font-semibold text-(--color-ink)">
                {participant.name}
              </h2>
              <p className="mt-2 text-sm text-(--color-slate)">
                Tiket ini berlaku untuk maksimal{" "}
                <span className="font-semibold text-(--color-ink)">
                  {participant.qty} orang
                </span>
                {participant.family_group && (
                  <> dari {participant.family_group}</>
                )}
                . Mohon konfirmasi kehadiranmu di bawah ini.
              </p>

              {step === "choice" && (
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={handleAttending}
                    className="flex items-center justify-center gap-2 rounded-lg bg-(--color-emerald) px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Ya, saya akan hadir
                  </button>
                  <button
                    onClick={handleNotAttending}
                    disabled={loading === "tidak"}
                    className="flex items-center justify-center gap-2 rounded-lg border border-(--color-border) px-4 py-3 text-sm font-semibold text-(--color-ink) hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loading === "tidak" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Tidak dapat hadir
                  </button>
                </div>
              )}

              {step === "qty" && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-medium text-(--color-ink)">
                    Berapa orang yang akan hadir?
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-(--color-border) text-(--color-ink) hover:bg-slate-50"
                      aria-label="Kurangi jumlah"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="font-display text-3xl font-semibold text-(--color-ink) w-16 text-center">
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty((q) => Math.min(participant.qty, q + 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-(--color-border) text-(--color-ink) hover:bg-slate-50"
                      aria-label="Tambah jumlah"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-center text-xs text-(--color-slate)">
                    Maksimal {participant.qty} orang
                  </p>

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => setStep("choice")}
                      className="flex-1 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50"
                    >
                      Kembali
                    </button>
                    <button
                      onClick={handleConfirmAttending}
                      disabled={loading === "hadir"}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-(--color-emerald) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {loading === "hadir" && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Kirim konfirmasi
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
