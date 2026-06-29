"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { QrCode, CheckCircle2, AlertCircle, Camera, CameraOff, Armchair, Keyboard, ScanLine, Maximize, Minimize } from "lucide-react";
import { checkInByCode } from "@/app/actions/checkin";
import { FamilyGroupBadge, QtyBadge } from "@/components/Badges";
import { formatPhoneDisplay } from "@/lib/utils";
import type { Participant } from "@/lib/types";

type ScanFeedback = { type: "idle" } | { type: "loading" } | { type: "success"; participant: Participant; alreadyCheckedIn: boolean } | { type: "error"; message: string };

type ScanMode = "camera" | "device";

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export function ScanClient() {
  const [mode, setMode] = useState<ScanMode>("camera");
  const [feedback, setFeedback] = useState<ScanFeedback>({ type: "idle" });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<Participant[]>([]);
  const [deviceInput, setDeviceInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRestartingCamera, setIsRestartingCamera] = useState(false);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  // Ref untuk menghindari stale closure & circular dependency: startCamera
  // dan restartCameraForResize saling membutuhkan satu sama lain, tapi
  // urutan definisinya tidak bisa keduanya saling mengacu langsung lewat
  // useCallback biasa. cameraActiveRef dipakai di listener fullscreenchange
  // supaya selalu membaca status TERBARU (bukan nilai yang "terjebak" dari
  // saat listener pertama kali didaftarkan).
  const startCameraRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const cameraActiveRef = useRef(false);

  const runCheckIn = useCallback(async (rawCode: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setFeedback({ type: "loading" });

    const result = await checkInByCode(rawCode);
    processingRef.current = false;

    if (!result.success || !result.participant) {
      setFeedback({
        type: "error",
        message: result.error ?? "Kode QR tidak valid.",
      });
      return;
    }

    setFeedback({
      type: "success",
      participant: result.participant,
      alreadyCheckedIn: !!result.alreadyCheckedIn,
    });
    setRecentScans((prev) => [result.participant!, ...prev].slice(0, 8));
  }, []);

  const handleDetected = useCallback(
    (decodedText: string) => {
      // Hindari proses ganda untuk kode yang sama dalam jeda singkat (debounce kamera,
      // karena html5-qrcode bisa memanggil callback berulang kali untuk QR yang sama).
      const now = Date.now();
      if (lastCodeRef.current && lastCodeRef.current.code === decodedText && now - lastCodeRef.current.at < 4000) {
        return;
      }
      lastCodeRef.current = { code: decodedText, at: now };
      runCheckIn(decodedText);
    },
    [runCheckIn],
  );

  // Submit dari input manual ATAU dari alat scanner USB/Bluetooth.
  // Alat scanner umumnya bekerja seperti keyboard: mengetik isi QR lalu
  // otomatis menekan Enter, sehingga cukup ditangkap lewat form submit biasa.
  function handleDeviceSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = deviceInput.trim();
    if (!code) return;
    setDeviceInput("");
    runCheckIn(code);
  }

  /**
   * html5-qrcode mengukur ukuran video HANYA SEKALI saat kamera di-start,
   * lalu memakai ukuran itu untuk dua hal sekaligus: (1) lebar/tinggi
   * elemen <video> di layar, dan (2) kanvas internal untuk crop & decode
   * QR (termasuk posisi kotak qrbox). Kedua hal ini dihitung bersamaan
   * dari satu pengukuran yang sama.
   *
   * Sebelumnya kami mencoba menimpa CSS video secara manual supaya
   * tampilannya menyesuaikan saat masuk/keluar mode layar penuh — tapi ini
   * HANYA memperbaiki tampilan visual, sedangkan kanvas internal untuk
   * decode QR tetap memakai ukuran lama (dari sebelum fullscreen). Akibatnya
   * video terlihat besar di layar, tapi area yang benar-benar di-scan oleh
   * decoder tidak match dengan apa yang user lihat — scan jadi gagal total
   * saat fullscreen.
   *
   * Solusi yang benar: restart kamera (stop lalu start ulang) setiap kali
   * status fullscreen berubah, supaya html5-qrcode mengukur ulang dari nol
   * berdasarkan ukuran container yang sudah benar — tampilan dan logic
   * decode kembali selaras. Konsekuensinya ada kedip singkat saat transisi
   * (kamera mati-hidup sebentar), tapi ini satu-satunya cara reliable tanpa
   * menyentuh internal library.
   */
  const restartCameraForResize = useCallback(async () => {
    if (!scannerRef.current) return;
    setIsRestartingCamera(true);
    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // kamera mungkin sudah dalam proses berhenti, aman diabaikan
    }
    scannerRef.current = null;

    // Beri waktu agar browser benar-benar selesai mengubah ukuran container
    // (masuk/keluar fullscreen) sebelum kamera baru mengukur ulang ukurannya.
    await new Promise((r) => setTimeout(r, 150));

    await startCameraRef.current?.();
    setIsRestartingCamera(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await fullscreenContainerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      // Beberapa browser/perangkat (terutama iOS Safari) tidak mendukung
      // Fullscreen API sama sekali — gagal secara diam-diam di sini,
      // kamera tetap berfungsi normal seperti biasa tanpa mode full screen.
      console.error("Gagal mengaktifkan/menonaktifkan mode layar penuh:", e);
    }
  }, []);

  // Browser bisa keluar dari mode full screen tanpa lewat tombol kita
  // (misal user menekan Esc, atau swipe-back di HP) — listener ini
  // memastikan state isFullscreen selalu sinkron dengan kondisi nyata
  // browser, bukan cuma mengandalkan klik tombol. Listener yang sama juga
  // memicu restart kamera setiap kali status berubah, sehingga perubahan
  // lewat Esc/back pun tetap membuat scan QR berfungsi dengan benar.
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
      if (cameraActiveRef.current) {
        restartCameraForResize();
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [restartCameraForResize]);

  // Keluar otomatis dari full screen jika kamera dimatikan atau pindah ke
  // mode alat scanner/manual — mode full screen hanya relevan untuk kamera.
  useEffect(() => {
    if ((!cameraActive || mode === "device") && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [cameraActive, mode]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const instance = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = instance;

      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleDetected(decodedText);
        },
        () => {
          // ignore scan failure per-frame, ini normal saat kamera mencari QR
        },
      );
      setCameraActive(true);
      cameraActiveRef.current = true;
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.");
      setCameraActive(false);
      cameraActiveRef.current = false;
    }
  }, [handleDetected]);

  // Selalu sinkronkan ref ini dengan state terbaru, supaya listener
  // fullscreenchange (yang didaftarkan sekali di awal) tetap membaca
  // status kamera yang akurat, bukan nilai lama dari saat listener
  // pertama kali didaftarkan.
  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);

  useEffect(() => {
    startCameraRef.current = startCamera;
  }, [startCamera]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // kamera mungkin sudah berhenti, aman diabaikan
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Saat pindah ke mode alat scanner, matikan kamera (kalau aktif) supaya tidak
  // berebut resource, dan fokuskan kursor ke kolom input agar alat scanner bisa
  // langsung "mengetik" hasil scan tanpa perlu klik manual.
  useEffect(() => {
    if (mode === "device") {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
        setCameraActive(false);
      }
      deviceInputRef.current?.focus();
    }
  }, [mode]);

  // Jaga agar fokus selalu balik ke kolom input setelah setiap scan selesai
  // diproses, sehingga alat scanner bisa langsung lanjut ke peserta berikutnya.
  useEffect(() => {
    if (mode === "device" && feedback.type !== "loading") {
      deviceInputRef.current?.focus();
    }
  }, [mode, feedback]);

  return (
    <div className="px-8 py-7">
      <h1 className="font-display text-2xl font-semibold text-(--color-ink)">Scan QR Code Peserta</h1>
      <p className="mt-1 text-sm text-(--color-slate)">{mode === "camera" ? "Arahkan kamera ke QR code pada tiket peserta untuk mencatat kehadiran." : "Arahkan alat scanner QR ke tiket peserta, atau ketik kode secara manual."}</p>

      <div className="mt-5 inline-flex gap-1.5 rounded-lg bg-slate-100 p-1">
        <button onClick={() => setMode("camera")} className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${mode === "camera" ? "bg-white text-(--color-ink) shadow-sm" : "text-(--color-slate)"}`}>
          <Camera className="h-4 w-4" />
          Kamera
        </button>
        <button onClick={() => setMode("device")} className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${mode === "device" ? "bg-white text-(--color-ink) shadow-sm" : "text-(--color-slate)"}`}>
          <ScanLine className="h-4 w-4" />
          Alat Scanner / Manual
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Kolom kamera atau input alat scanner */}
        <div
          ref={fullscreenContainerRef}
          className={isFullscreen ? "fixed inset-0 z-50 flex flex-col bg-(--color-ink) p-3" : "rounded-xl border border-(--color-border) bg-white p-5"}
          style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
        >
          {mode === "camera" ? (
            <>
              <div className={isFullscreen ? "relative w-full flex-1 overflow-hidden rounded-xl bg-(--color-ink)" : "relative mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-xl bg-(--color-ink)"}>
                <div id={SCANNER_ELEMENT_ID} className="absolute inset-0 h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />
                {!cameraActive && !isRestartingCamera && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--color-ink) text-white/70">
                    <QrCode className="h-12 w-12" strokeWidth={1.5} />
                    <p className="text-sm">Kamera belum aktif</p>
                  </div>
                )}

                {/* Overlay singkat saat kamera di-restart untuk menyesuaikan
                    ukuran (masuk/keluar layar penuh) — tanpa ini, kedip
                    sesaat saat transisi bisa terlihat seperti aplikasi macet. */}
                {isRestartingCamera && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-(--color-ink) text-white/70">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <p className="text-sm">Menyesuaikan tampilan kamera...</p>
                  </div>
                )}

                {/* Tombol layar penuh — selalu mengambang di pojok kanan atas
                    area kamera, baik dalam mode normal maupun full screen,
                    supaya mudah dijangkau tanpa perlu cari tombol lain. */}
                {cameraActive && (
                  <button
                    onClick={toggleFullscreen}
                    disabled={isRestartingCamera}
                    className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/70 disabled:opacity-50"
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize className="h-3.5 w-3.5" />
                        Keluar Layar Penuh
                      </>
                    ) : (
                      <>
                        <Maximize className="h-3.5 w-3.5" />
                        Layar Penuh
                      </>
                    )}
                  </button>
                )}

                {/* Saat full screen, feedback hasil scan & riwayat ditampilkan
                    sebagai overlay mengambang di atas video, karena UI lain
                    (judul halaman, tombol mode, dst) tidak terlihat. */}
                {isFullscreen && (
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4">
                    <ScanFeedbackPanel feedback={feedback} />
                    {recentScans.length > 0 && (
                      <div className="ml-auto w-full max-w-xs rounded-xl bg-black/50 p-3 backdrop-blur-sm">
                        <p className="text-xs font-semibold text-white/80">Riwayat Scan Sesi Ini</p>
                        <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto thin-scrollbar">
                          {recentScans.slice(0, 4).map((p, idx) => (
                            <li key={`${p.id}-${idx}`} className="flex items-center justify-between gap-2 text-xs text-white">
                              <span className="truncate">{p.name}</span>
                              <span className="shrink-0 text-white/60">{p.qty} pax</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isFullscreen && (
                <>
                  {cameraError && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  <div className="mt-4 flex justify-center">
                    {cameraActive ? (
                      <button onClick={stopCamera} className="flex items-center gap-2 rounded-lg border border-(--color-border) px-5 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50">
                        <CameraOff className="h-4 w-4" />
                        Matikan kamera
                      </button>
                    ) : (
                      <button onClick={startCamera} className="flex items-center gap-2 rounded-lg bg-(--color-ink) px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                        <Camera className="h-4 w-4" />
                        Aktifkan kamera
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                <Keyboard className="h-9 w-9 text-(--color-slate)" strokeWidth={1.5} />
              </div>
              <p className="mt-3 text-center text-sm text-(--color-slate)">
                Klik kolom di bawah, lalu scan tiket pakai alat scanner —
                <br />
                kode akan otomatis terisi dan terverifikasi.
              </p>

              <form onSubmit={handleDeviceSubmit} className="mt-4 w-full max-w-sm">
                <div className="flex gap-2">
                  <input
                    ref={deviceInputRef}
                    value={deviceInput}
                    onChange={(e) => setDeviceInput(e.target.value)}
                    placeholder="EVT-XXXXXXXX atau ketik manual"
                    autoFocus
                    className="flex-1 rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm font-mono focus:border-(--color-ink) focus:outline-none"
                  />
                  <button type="submit" className="shrink-0 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                    Cek
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-(--color-slate-light)">Kolom ini tetap aktif menunggu input — tidak perlu klik ulang antar peserta.</p>
              </form>
            </div>
          )}

          {/* Feedback hasil scan terbaru, besar dan jelas untuk dilihat dari jarak agak jauh.
              Saat full screen, feedback sudah ditampilkan sebagai overlay di atas
              video (lihat di atas), sehingga tidak perlu dirender dua kali di sini. */}
          {!isFullscreen && (
            <div className="mt-5">
              <ScanFeedbackPanel feedback={feedback} />
            </div>
          )}
        </div>

        {/* Kolom riwayat scan */}
        <div className="rounded-xl border border-(--color-border) bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-(--color-ink)">Riwayat Scan Sesi Ini</h2>
          {recentScans.length === 0 ? (
            <p className="mt-3 text-sm text-(--color-slate)">Belum ada peserta yang di-scan.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {recentScans.map((p, idx) => (
                <li key={`${p.id}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-(--color-ink)">{p.name}</p>
                    <p className="text-xs text-(--color-slate)">Kursi/Meja {p.seat_number}</p>
                  </div>
                  <QtyBadge qty={p.qty} rsvp_qty_response={p.rsvp_qty_response} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Panel feedback hasil scan, diekstrak jadi komponen terpisah agar bisa
 * dipakai baik di tampilan normal (di bawah kotak kamera) maupun sebagai
 * overlay mengambang saat mode layar penuh aktif — tanpa duplikasi kode.
 */
function ScanFeedbackPanel({ feedback }: { feedback: ScanFeedback }) {
  if (feedback.type === "idle") {
    return <div className="rounded-xl border border-dashed border-(--color-border) bg-white/90 px-5 py-6 text-center text-sm text-(--color-slate)">Hasil scan akan muncul di sini</div>;
  }

  if (feedback.type === "loading") {
    return <div className="rounded-xl bg-slate-100 px-5 py-6 text-center text-sm text-(--color-slate)">Memeriksa kode...</div>;
  }

  if (feedback.type === "error") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-red-50 px-5 py-4 text-red-700">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-display text-sm font-semibold">Gagal check-in</p>
          <p className="mt-0.5 text-sm">{feedback.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl px-5 py-4 ${feedback.alreadyCheckedIn ? "bg-(--color-amber-soft)" : "bg-(--color-emerald-soft)"}`}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className={`h-5 w-5 ${feedback.alreadyCheckedIn ? "text-amber-600" : "text-(--color-emerald)"}`} />
        <p className={`font-display text-sm font-semibold ${feedback.alreadyCheckedIn ? "text-amber-800" : "text-emerald-800"}`}>{feedback.alreadyCheckedIn ? "Sudah check-in sebelumnya" : "Check-in berhasil"}</p>
      </div>
      <p className="mt-2 font-display text-lg font-semibold text-(--color-ink)">{feedback.participant.name}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <FamilyGroupBadge familyGroup={feedback.participant.family_group} />
        <QtyBadge qty={feedback.participant.qty} rsvp_qty_response={feedback.participant.rsvp_qty_response} />
        <span className="flex items-center gap-1 text-xs text-(--color-slate)">
          <Armchair className="h-3 w-3" />
          Kursi/Meja {feedback.participant.seat_number}
        </span>
      </div>
      <p className="mt-1 text-xs text-(--color-slate)">{formatPhoneDisplay(feedback.participant.phone)}</p>
      {feedback.participant.qty > 1 && <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-xs font-medium text-(--color-ink)">Tiket ini berlaku untuk {feedback.participant.qty} orang — pastikan seluruh rombongan sudah memasuki lokasi acara.</p>}
    </div>
  );
}
