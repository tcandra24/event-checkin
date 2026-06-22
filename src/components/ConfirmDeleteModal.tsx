"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { deleteParticipant } from "@/app/actions/participants";

export function ConfirmDeleteModal({
  participantId,
  participantName,
  onClose,
  onDeleted,
}: {
  participantId: string;
  participantName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await deleteParticipant(participantId);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Gagal menghapus, coba lagi.");
      return;
    }
    onDeleted();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <h2 className="mt-3 font-display text-base font-semibold text-(--color-ink)">
          Hapus data peserta?
        </h2>
        <p className="mt-1 text-sm text-(--color-slate)">
          Data <span className="font-medium text-(--color-ink)">{participantName}</span>{" "}
          akan dihapus permanen, termasuk QR code dan riwayat kehadirannya. Tindakan ini
          tidak dapat dibatalkan.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
