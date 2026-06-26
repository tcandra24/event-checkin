"use client";

import { useState } from "react";
import { Loader2, X, CheckCircle2, XCircle, Minus, Plus } from "lucide-react";
import type { Participant } from "@/lib/types";
import { approveRsvp, rejectRsvp } from "@/app/actions/rsvpAdmin";

export function RsvpReviewModal({
  participant,
  onClose,
  onReviewed,
}: {
  participant: Participant;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [finalQty, setFinalQty] = useState(
    participant.rsvp_qty_response ?? participant.qty
  );
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading("approve");
    setError(null);
    const result = await approveRsvp(participant.id, finalQty);
    setLoading(null);

    if (!result.success) {
      setError(result.error ?? "Gagal menyetujui RSVP.");
      return;
    }
    onReviewed();
  }

  async function handleReject() {
    setLoading("reject");
    setError(null);
    const result = await rejectRsvp(participant.id);
    setLoading(null);

    if (!result.success) {
      setError(result.error ?? "Gagal menolak RSVP.");
      return;
    }
    onReviewed();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-(--color-border) px-6 py-4">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">
            Review Konfirmasi Kehadiran
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-(--color-slate) hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="font-display text-lg font-semibold text-(--color-ink)">
            {participant.name}
          </p>
          <p className="mt-1 text-sm text-(--color-slate)">
            {participant.family_group} · Kursi {participant.seat_number}
          </p>

          <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Peserta mengonfirmasi akan hadir bersama{" "}
            <span className="font-semibold">
              {participant.rsvp_qty_response} orang
            </span>{" "}
            (kapasitas tiket maksimal {participant.qty} orang).
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
              Jumlah final yang disetujui
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFinalQty((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--color-border) text-(--color-ink) hover:bg-slate-50"
                aria-label="Kurangi"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={1}
                max={participant.qty}
                value={finalQty}
                onChange={(e) =>
                  setFinalQty(
                    Math.min(participant.qty, Math.max(1, Number(e.target.value) || 1))
                  )
                }
                className="w-20 rounded-lg border border-(--color-border) px-3 py-2.5 text-center text-sm focus:border-(--color-ink) focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setFinalQty((q) => Math.min(participant.qty, q + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--color-border) text-(--color-ink) hover:bg-slate-50"
                aria-label="Tambah"
              >
                <Plus className="h-4 w-4" />
              </button>
              <p className="text-xs text-(--color-slate)">maks. {participant.qty}</p>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleReject}
              disabled={loading !== null}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50 disabled:opacity-60"
            >
              {loading === "reject" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Tolak
            </button>
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-(--color-emerald) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Setujui
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
