"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Save, CheckCircle2, ImageIcon, Check, Images } from "lucide-react";
import type { EventSettings } from "@/lib/types";
import { updateEventSettings, uploadTicketBackground, selectTicketBackground, type TicketBackgroundItem } from "@/app/actions/eventSettings";

// Batas ukuran file diecek di sini (client) SEBELUM upload dimulai, supaya
// pengguna langsung tahu filenya kelebihan ukuran tanpa perlu menunggu
// proses unggah selesai dulu. Server tetap memvalidasi ulang nilai yang
// sama persis sebagai lapis pertahanan kedua (lihat uploadTicketBackground
// di eventSettings.ts) — client-side check ini murni untuk kecepatan
// feedback ke pengguna, bukan satu-satunya lapisan validasi.
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const MAX_FILE_SIZE_LABEL = "1MB";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PengaturanClient({ initialSettings, initialGallery }: { initialSettings: EventSettings | null; initialGallery: TicketBackgroundItem[] }) {
  const router = useRouter();
  const [eventName, setEventName] = useState(initialSettings?.event_name ?? "");
  const [eventAddress, setEventAddress] = useState(initialSettings?.event_address ?? "");
  const [backgroundUrl, setBackgroundUrl] = useState(initialSettings?.ticket_background_url ?? null);
  const [gallery, setGallery] = useState(initialGallery);
  const [savingInfo, setSavingInfo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectingUrl, setSelectingUrl] = useState<string | null>(null);
  const [infoSaved, setInfoSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
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

    setImageError(null);

    // Validasi instan di sisi client — sebelum file ditembak ke server.
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setImageError(`Ukuran file (${formatFileSize(file.size)}) melebihi batas maksimal ${MAX_FILE_SIZE_LABEL}. Pilih gambar lain atau kompres terlebih dahulu.`);
      // Kosongkan input supaya user bisa memilih file yang sama lagi setelah
      // mengompresnya, tanpa input "menolak" perubahan karena nama file sama.
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setImageError("Format gambar harus PNG, JPG, atau WEBP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingImage(true);

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadTicketBackground(formData);
    setUploadingImage(false);

    if (!result.success) {
      setImageError(result.error ?? "Gagal mengunggah gambar.");
      return;
    }

    setBackgroundUrl(result.url ?? null);
    if (result.url) {
      // Tambahkan ke galeri secara optimistic supaya langsung terlihat
      // tanpa perlu menunggu router.refresh() / reload data dari server.
      setGallery((prev) => [{ path: `backgrounds/${Date.now()}`, url: result.url!, uploadedAt: new Date().toISOString() }, ...prev]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  async function handleSelectFromGallery(item: TicketBackgroundItem) {
    setSelectingUrl(item.url);
    setImageError(null);

    const result = await selectTicketBackground(item.url);
    setSelectingUrl(null);

    if (!result.success) {
      setImageError(result.error ?? "Gagal memilih gambar.");
      return;
    }

    setBackgroundUrl(item.url);
    router.refresh();
  }

  return (
    <div className="px-8 py-7">
      <h1 className="font-display text-2xl font-semibold text-(--color-ink)">Pengaturan Tiket</h1>
      <p className="mt-1 text-sm text-(--color-slate)">Atur informasi acara dan desain latar tiket QR yang akan diterima setiap peserta.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form info acara */}
        <form onSubmit={handleSaveInfo} className="rounded-xl border border-(--color-border) bg-white p-6">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">Informasi Acara</h2>
          <p className="mt-1 text-sm text-(--color-slate)">Teks ini akan ditampilkan pada bagian atas setiap tiket QR peserta.</p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Nama acara</label>
              <input
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Contoh: The Holy Matrimony of Kevin & Michiko"
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Alamat / lokasi acara</label>
              <textarea
                value={eventAddress}
                onChange={(e) => setEventAddress(e.target.value)}
                rows={3}
                placeholder="Contoh: Gereja Katolik Santo Yakobus, Sabtu 02 Mei 2026"
                className="w-full resize-none rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
            </div>
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={savingInfo} className="mt-5 flex items-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : infoSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {infoSaved ? "Tersimpan" : "Simpan informasi"}
          </button>
        </form>

        {/* Upload background tiket */}
        <div className="rounded-xl border border-(--color-border) bg-white p-6">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">Latar Belakang Tiket</h2>
          <p className="mt-1 text-sm text-(--color-slate)">Unggah 1 gambar (disarankan rasio potret, contoh 800×1420px) yang akan dipakai sebagai latar untuk seluruh tiket QR peserta — mirip desain undangan fisik.</p>

          <div className="mt-4">
            {backgroundUrl ? (
              <div className="relative mx-auto w-full max-w-55 overflow-hidden rounded-xl border border-(--color-border)">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview gambar dari Supabase Storage, ukuran dinamis */}
                <img src={backgroundUrl} alt="Latar belakang tiket" className="w-full object-cover" />
              </div>
            ) : (
              <div className="flex aspect-8/14 w-full max-w-55 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--color-border) bg-slate-50 text-center">
                <ImageIcon className="h-8 w-8 text-(--color-slate-light)" />
                <p className="px-4 text-xs text-(--color-slate)">Belum ada gambar latar diunggah</p>
              </div>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center gap-2 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50 disabled:opacity-60"
            >
              {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingImage ? "Mengunggah..." : backgroundUrl ? "Unggah gambar baru" : "Unggah gambar latar"}
            </button>

            {gallery.length > 0 && (
              <button type="button" onClick={() => setShowGallery((v) => !v)} className="flex items-center gap-2 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50">
                <Images className="h-4 w-4" />
                {showGallery ? "Sembunyikan riwayat" : `Pilih dari riwayat (${gallery.length})`}
              </button>
            )}
          </div>

          {imageError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{imageError}</p>}

          <p className="mt-2 text-xs text-(--color-slate)">Format PNG, JPG, atau WEBP. Maksimal {MAX_FILE_SIZE_LABEL}.</p>

          {/* Galeri riwayat gambar yang pernah diunggah — setiap unggahan
              baru disimpan sebagai file terpisah, tidak menimpa file lama,
              sehingga bisa dipilih kembali kapan saja tanpa upload ulang. */}
          {showGallery && gallery.length > 0 && (
            <div className="mt-5 border-t border-(--color-border) pt-4">
              <p className="text-sm font-medium text-(--color-ink)">Riwayat gambar yang pernah diunggah</p>
              <p className="mt-1 text-xs text-(--color-slate)">Klik salah satu gambar untuk menjadikannya latar tiket aktif.</p>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {gallery.map((item) => {
                  const isActive = item.url === backgroundUrl;
                  const isSelecting = selectingUrl === item.url;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleSelectFromGallery(item)}
                      disabled={isActive || selectingUrl !== null}
                      className={`group relative aspect-8/14 overflow-hidden rounded-lg border-2 transition-colors disabled:cursor-default ${isActive ? "border-(--color-ink)" : "border-(--color-border) hover:border-(--color-slate)"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail riwayat dari Supabase Storage */}
                      <img src={item.url} alt="Riwayat gambar latar tiket" className="h-full w-full object-cover" />
                      {isActive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-(--color-ink)">
                            <Check className="h-3 w-3" />
                            Aktif
                          </span>
                        </div>
                      )}
                      {isSelecting && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                      {!isActive && !isSelecting && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-(--color-ink)">Gunakan</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
