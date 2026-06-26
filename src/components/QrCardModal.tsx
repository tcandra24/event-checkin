"use client";

import { useEffect, useState } from "react";
import { Download, X, Loader2, AlertCircle } from "lucide-react";
import type { Participant } from "@/lib/types";
import { generateTicketCardForParticipant } from "@/app/actions/ticketCard";

export function QrCardModal({
  participant,
  onClose,
}: {
  participant: Participant;
  onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    generateTicketCardForParticipant(participant.id).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.success || !result.dataUrl) {
        setError(result.error ?? "Gagal membuat kartu tiket.");
        return;
      }
      setImageUrl(result.dataUrl);
    });

    return () => {
      active = false;
    };
  }, [participant.id]);

  function handleDownload() {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `Tiket-${participant.code}.png`;
    link.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between bg-(--color-ink) px-5 py-3.5">
            <p className="font-display text-sm font-semibold text-white">
              Tiket Digital Peserta
            </p>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center bg-slate-100 px-4 py-4">
            {loading && (
              <div className="flex h-96 w-full flex-col items-center justify-center gap-2 text-(--color-slate)">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Membuat tiket...</p>
              </div>
            )}

            {error && (
              <div className="flex h-96 w-full flex-col items-center justify-center gap-2 px-6 text-center text-red-600">
                <AlertCircle className="h-6 w-6" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {imageUrl && !loading && (
              // eslint-disable-next-line @next/next/no-img-element -- data URL base64 dinamis hasil render server, tidak didukung next/image
              <img
                src={imageUrl}
                alt={`Tiket untuk ${participant.name}`}
                className="max-h-[70vh] w-full rounded-lg object-contain shadow-sm"
              />
            )}
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={!imageUrl}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-(--color-ink) shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          Unduh tiket (PNG)
        </button>
      </div>
    </div>
  );
}
