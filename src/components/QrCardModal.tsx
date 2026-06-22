"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, X } from "lucide-react";
import type { Participant } from "@/lib/types";
import { CategoryBadge } from "@/components/Badges";
import { formatPhoneDisplay } from "@/lib/utils";

export function QrCardModal({
  participant,
  onClose,
}: {
  participant: Participant;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    QRCode.toDataURL(participant.code, { width: 600, margin: 1 }).then(
      setQrUrl
    );
  }, [participant.code]);

  function handleDownload() {
    if (!qrUrl) return;
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `QR-${participant.code}.png`;
    link.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        ref={cardRef}
      >
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

          <div className="px-6 pt-6">
            <p className="font-display text-lg font-semibold text-(--color-ink)">
              {participant.name}
            </p>
            {participant.company && (
              <p className="text-sm text-(--color-slate)">{participant.company}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <CategoryBadge category={participant.category} />
              <span className="text-xs text-(--color-slate)">
                {formatPhoneDisplay(participant.phone)}
              </span>
            </div>
          </div>

          <div className="ticket-perforation my-5 border-t border-dashed border-(--color-border)" />

          <div className="flex flex-col items-center px-6 pb-6">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL base64 dinamis, tidak didukung next/image
              <img
                src={qrUrl}
                alt={`QR code untuk ${participant.name}`}
                className="h-48 w-48"
              />
            ) : (
              <div className="h-48 w-48 animate-pulse rounded-lg bg-slate-100" />
            )}
            <p className="mt-3 font-mono text-sm font-medium tracking-wide text-(--color-ink)">
              {participant.code}
            </p>
            <p className="mt-1 text-center text-xs text-(--color-slate)">
              Tunjukkan QR ini saat tiba di lokasi acara
            </p>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={!qrUrl}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-(--color-ink) shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          Unduh gambar QR
        </button>
      </div>
    </div>
  );
}
