"use client";

import { useMemo, useState } from "react";
import { Search, MessageSquareText, Ban, CheckCircle2 } from "lucide-react";
import type { BroadcastLogItem } from "@/app/actions/broadcast";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPanitiaName(
  userId: string | null,
  panitiaEmailMap: Record<string, string>
): string {
  if (!userId) return "—";
  const email = panitiaEmailMap[userId];
  if (!email) return "Panitia tidak diketahui";
  return email.split("@")[0];
}

function formatTargetFilter(filter: string): string {
  if (filter === "all") return "Semua peserta";
  if (filter === "belum_hadir") return "Belum hadir saja";
  if (filter === "hadir") return "Sudah hadir saja";
  return filter; // nama family_group spesifik
}

export function RiwayatBroadcastClient({
  history,
  panitiaEmailMap,
}: {
  history: BroadcastLogItem[];
  panitiaEmailMap: Record<string, string>;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase();
    return history.filter(
      (h) =>
        h.message.toLowerCase().includes(q) ||
        formatTargetFilter(h.targetFilter).toLowerCase().includes(q) ||
        formatPanitiaName(h.sentBy, panitiaEmailMap).toLowerCase().includes(q)
    );
  }, [history, search, panitiaEmailMap]);

  return (
    <div className="px-8 py-7">
      <h1 className="font-display text-2xl font-semibold text-(--color-ink)">
        Riwayat Broadcast WhatsApp
      </h1>
      <p className="mt-1 text-sm text-(--color-slate)">
        Daftar seluruh broadcast yang pernah dikirim, termasuk yang dibatalkan
        di tengah jalan.
      </p>

      <div className="mt-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-slate-light)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari isi pesan, target, atau pengirim..."
            className="w-full rounded-lg border border-(--color-border) bg-white py-2.5 pl-9 pr-3 text-sm focus:border-(--color-ink) focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-(--color-border) bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <MessageSquareText className="h-6 w-6 text-(--color-slate-light)" />
            </div>
            <p className="mt-3 font-display text-sm font-semibold text-(--color-ink)">
              {history.length === 0
                ? "Belum ada broadcast yang pernah dikirim"
                : "Tidak ada riwayat yang cocok"}
            </p>
            <p className="mt-1 text-sm text-(--color-slate)">
              {history.length === 0
                ? "Riwayat akan muncul di sini setiap kali broadcast WhatsApp selesai atau dibatalkan."
                : "Coba ubah kata pencarian."}
            </p>
          </div>
        ) : (
          <>
            {/* TABEL DESKTOP */}
            <div className="hidden md:block overflow-x-auto thin-scrollbar">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-(--color-border) bg-slate-50 text-xs uppercase tracking-wide text-(--color-slate)">
                    <th className="px-5 py-3 font-medium">Waktu</th>
                    <th className="px-5 py-3 font-medium">Isi Pesan</th>
                    <th className="px-5 py-3 font-medium">Target</th>
                    <th className="px-5 py-3 font-medium">Dikirim Oleh</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Hasil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border)">
                  {filtered.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/60 align-top">
                      <td className="px-5 py-3.5 text-(--color-slate) whitespace-nowrap">
                        {formatDateTime(h.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="line-clamp-2 text-(--color-ink)">{h.message}</p>
                      </td>
                      <td className="px-5 py-3.5 text-(--color-slate)">
                        {formatTargetFilter(h.targetFilter)}
                      </td>
                      <td className="px-5 py-3.5 text-(--color-slate)">
                        {formatPanitiaName(h.sentBy, panitiaEmailMap)}
                      </td>
                      <td className="px-5 py-3.5">
                        {h.wasCancelled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-(--color-slate)">
                            <Ban className="h-3 w-3" />
                            Dibatalkan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-emerald-soft) px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Selesai
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className="text-emerald-700 font-medium">
                          {h.totalSuccess}
                        </span>
                        <span className="text-(--color-slate)"> berhasil</span>
                        {h.totalFailed > 0 && (
                          <>
                            <span className="text-(--color-slate)">, </span>
                            <span className="text-red-600 font-medium">
                              {h.totalFailed}
                            </span>
                            <span className="text-(--color-slate)"> gagal</span>
                          </>
                        )}
                        <p className="text-xs text-(--color-slate-light)">
                          dari {h.totalRecipients} target
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CARD VIEW MOBILE */}
            <div className="md:hidden divide-y divide-(--color-border)">
              {filtered.map((h) => (
                <div key={h.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-(--color-slate)">
                      {formatDateTime(h.createdAt)}
                    </p>
                    {h.wasCancelled ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-(--color-slate)">
                        <Ban className="h-3 w-3" />
                        Dibatalkan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-emerald-soft) px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Selesai
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-(--color-ink)">
                    {h.message}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--color-slate)">
                    <span>Target: {formatTargetFilter(h.targetFilter)}</span>
                    <span>Oleh: {formatPanitiaName(h.sentBy, panitiaEmailMap)}</span>
                  </div>
                  <p className="mt-1.5 text-xs">
                    <span className="font-medium text-emerald-700">
                      {h.totalSuccess} berhasil
                    </span>
                    {h.totalFailed > 0 && (
                      <span className="font-medium text-red-600">
                        {" "}
                        · {h.totalFailed} gagal
                      </span>
                    )}
                    <span className="text-(--color-slate-light)">
                      {" "}
                      dari {h.totalRecipients} target
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-(--color-slate)">
        Menampilkan {filtered.length} dari {history.length} riwayat broadcast
        (maksimal 200 terbaru)
      </p>
    </div>
  );
}
