"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Save, CheckCircle2, ImageIcon } from "lucide-react";
import type { EventSettings } from "@/lib/types";
import {
  updateEventSettings,
  uploadTicketBackground,
} from "@/app/actions/eventSettings";

export function PengaturanClient({
  initialSettings,
}: {
  initialSettings: EventSettings | null;
}) {
  const router = useRouter();
  const [eventName, setEventName] = useState(initialSettings?.event_name ?? "");
  const [eventAddress, setEventAddress] = useState(
    initialSettings?.event_address ?? ""
  );
  const [backgroundUrl, setBackgroundUrl] = useState(
    initialSettings?.ticket_background_url ?? null
  );
  const [savingInfo, setSavingInfo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);
    setError(null);
    setInfoSaved(false);

    const result = await updateEventSettings({ eventName, eventAddress });
    setSavingInfo(false);

    if (!result.success) {
      setError(result.error ?? "Gagal menyimpan, coba lagi.");
      return;
    }
    setInfoSaved(true);
    router.refresh();
    setTimeout(() => setInfoSaved(false), 2500);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadTicketBackground(formData);
    setUploadingImage(false);

    if (!result.success) {
      setError(result.error ?? "Gagal mengunggah gambar.");
      return;
    }

    setBackgroundUrl(result.url ?? null);
    router.refresh();
  }

  return (
    <div className="px-8 py-7">
      <h1 className="font-display text-2xl font-semibold text-(--color-ink)">
        Pengaturan Tiket
      </h1>
      <p className="mt-1 text-sm text-(--color-slate)">
        Atur informasi acara dan desain latar tiket QR yang akan diterima setiap
        peserta.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form info acara */}
        <form
          onSubmit={handleSaveInfo}
          className="rounded-xl border border-(--color-border) bg-white p-6"
        >
          <h2 className="font-display text-base font-semibold text-(--color-ink)">
            Informasi Acara
          </h2>
          <p className="mt-1 text-sm text-(--color-slate)">
            Teks ini akan ditampilkan pada bagian atas setiap tiket QR peserta.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Nama acara
              </label>
              <input
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Contoh: The Holy Matrimony of Kevin & Michiko"
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Alamat / lokasi acara
              </label>
              <textarea
                value={eventAddress}
                onChange={(e) => setEventAddress(e.target.value)}
                rows={3}
                placeholder="Contoh: Gereja Katolik Santo Yakobus, Sabtu 02 Mei 2026"
                className="w-full resize-none rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={savingInfo}
            className="mt-5 flex items-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {savingInfo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : infoSaved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {infoSaved ? "Tersimpan" : "Simpan informasi"}
          </button>
        </form>

        {/* Upload background tiket */}
        <div className="rounded-xl border border-(--color-border) bg-white p-6">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">
            Latar Belakang Tiket
          </h2>
          <p className="mt-1 text-sm text-(--color-slate)">
            Unggah 1 gambar (disarankan rasio potret, contoh 800×1420px) yang akan
            dipakai sebagai latar untuk seluruh tiket QR peserta — mirip desain
            undangan fisik.
          </p>

          <div className="mt-4">
            {backgroundUrl ? (
              <div className="relative mx-auto w-full max-w-[220px] overflow-hidden rounded-xl border border-(--color-border)">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview gambar dari Supabase Storage, ukuran dinamis */}
                <img
                  src={backgroundUrl}
                  alt="Latar belakang tiket"
                  className="w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-[8/14] w-full max-w-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--color-border) bg-slate-50 text-center">
                <ImageIcon className="h-8 w-8 text-(--color-slate-light)" />
                <p className="px-4 text-xs text-(--color-slate)">
                  Belum ada gambar latar diunggah
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="mt-4 flex items-center gap-2 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50 disabled:opacity-60"
          >
            {uploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadingImage
              ? "Mengunggah..."
              : backgroundUrl
              ? "Ganti gambar latar"
              : "Unggah gambar latar"}
          </button>
          <p className="mt-2 text-xs text-(--color-slate)">
            Format PNG, JPG, atau WEBP. Maksimal 8MB.
          </p>
        </div>
      </div>
    </div>
  );
}
