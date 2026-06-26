"use client";

import { useMemo, useState } from "react";
import { Search, Download, UserCheck, UserX, Users2 } from "lucide-react";
import type { Participant } from "@/lib/types";
import { StatusBadge, FamilyGroupBadge, QtyBadge, RsvpBadge } from "@/components/Badges";
import { formatPhoneDisplay } from "@/lib/utils";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LaporanClient({ participants }: { participants: Participant[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "hadir" | "belum_hadir">("all");
  const [familyFilter, setFamilyFilter] = useState<string>("all");

  const familyOptions = useMemo(() => {
    return Array.from(new Set(participants.map((p) => p.family_group))).sort();
  }, [participants]);

  const stats = useMemo(() => {
    const totalPeople = participants.reduce((sum, p) => sum + p.qty, 0);
    const totalTickets = participants.length;
    const hadirTickets = participants.filter((p) => p.status === "hadir");
    const hadirPeople = hadirTickets.reduce((sum, p) => sum + p.qty, 0);
    return {
      totalTickets,
      totalPeople,
      hadirTickets: hadirTickets.length,
      hadirPeople,
      belumHadirTickets: totalTickets - hadirTickets.length,
      belumHadirPeople: totalPeople - hadirPeople,
    };
  }, [participants]);

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search) || p.seat_number.toLowerCase().includes(search.toLowerCase()) || p.family_group.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchFamily = familyFilter === "all" || p.family_group === familyFilter;
      return matchSearch && matchStatus && matchFamily;
    });
  }, [participants, search, statusFilter, familyFilter]);

  function rsvpLabel(status: Participant["rsvp_status"]): string {
    switch (status) {
      case "menunggu_approval":
        return "Menunggu Approval";
      case "dikonfirmasi_hadir":
        return "Dikonfirmasi Hadir";
      case "dikonfirmasi_tidak_hadir":
        return "Dikonfirmasi Tidak Hadir";
      default:
        return "Belum Konfirmasi";
    }
  }

  function handleExportCsv() {
    const headers = ["Nama", "No HP", "Nomor Kursi", "Keluarga", "Qty", "Status Kehadiran", "Waktu Check-in", "Status RSVP", "Jumlah RSVP", "Kode"];
    const rows = filtered.map((p) => [
      p.name,
      formatPhoneDisplay(p.phone),
      p.seat_number,
      p.family_group,
      p.qty,
      p.status === "hadir" ? "Hadir" : "Belum Hadir",
      formatDateTime(p.checked_in_at),
      rsvpLabel(p.rsvp_status),
      p.rsvp_qty_response ?? "",
      p.code,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-kehadiran-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const attendanceRate = stats.totalPeople > 0 ? Math.round((stats.hadirPeople / stats.totalPeople) * 100) : 0;

  return (
    <div className="px-8 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--color-ink)">Laporan Kehadiran</h1>
          <p className="mt-1 text-sm text-(--color-slate)">Pantau peserta yang sudah dan belum hadir secara real-time.</p>
        </div>
        <button onClick={handleExportCsv} className="flex items-center gap-2 rounded-lg border border-(--color-border) bg-white px-4 py-2.5 text-sm font-semibold text-(--color-ink) shadow-sm hover:bg-slate-50">
          <Download className="h-4 w-4" />
          Ekspor CSV
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-(--color-border) bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-(--color-slate)">Total Tamu</p>
            <Users2 className="h-4 w-4 text-(--color-slate-light)" />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-(--color-ink)">{stats.totalPeople}</p>
          <p className="mt-1 text-xs text-(--color-slate)">dari {stats.totalTickets} tiket/QR terdaftar</p>
        </div>
        <div className="rounded-xl border border-(--color-border) bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-(--color-slate)">Sudah Hadir</p>
            <UserCheck className="h-4 w-4 text-(--color-emerald)" />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-emerald-600">{stats.hadirPeople}</p>
          <p className="mt-1 text-xs text-(--color-slate)">
            {attendanceRate}% tingkat kehadiran · {stats.hadirTickets} tiket
          </p>
        </div>
        <div className="rounded-xl border border-(--color-border) bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-(--color-slate)">Belum Hadir</p>
            <UserX className="h-4 w-4 text-(--color-amber)" />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-amber-600">{stats.belumHadirPeople}</p>
          <p className="mt-1 text-xs text-(--color-slate)">{stats.belumHadirTickets} tiket</p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-(--color-emerald) transition-all" style={{ width: `${attendanceRate}%` }} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-60 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-slate-light)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, HP, kursi, atau keluarga..."
            className="w-full rounded-lg border border-(--color-border) bg-white py-2.5 pl-9 pr-3 text-sm focus:border-(--color-ink) focus:outline-none"
          />
        </div>
        <select value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)} className="rounded-lg border border-(--color-border) bg-white px-3 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none">
          <option value="all">Semua keluarga</option>
          {familyOptions.map((fg) => (
            <option key={fg} value={fg}>
              {fg}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1">
          {(
            [
              { value: "all", label: "Semua" },
              { value: "hadir", label: "Hadir" },
              { value: "belum_hadir", label: "Belum hadir" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === opt.value ? "bg-white text-(--color-ink) shadow-sm" : "text-(--color-slate)"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-(--color-border) bg-white">
        <div className="hidden md:block overflow-x-auto thin-scrollbar">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-slate-50 text-xs uppercase tracking-wide text-(--color-slate)">
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-5 py-3 font-medium">Kontak</th>
                <th className="px-5 py-3 font-medium">Kursi</th>
                <th className="px-5 py-3 font-medium">Keluarga</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">RSVP</th>
                <th className="px-5 py-3 font-medium">Waktu Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-(--color-slate)">
                    Tidak ada data yang cocok dengan pencarian atau filter ini.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-(--color-ink)">{p.name}</p>
                    </td>
                    <td className="px-5 py-3.5 text-(--color-slate)">{formatPhoneDisplay(p.phone)}</td>
                    <td className="px-5 py-3.5 font-mono text-(--color-slate)">{p.seat_number}</td>
                    <td className="px-5 py-3.5">
                      <FamilyGroupBadge familyGroup={p.family_group} />
                    </td>
                    <td className="px-5 py-3.5">
                      <QtyBadge qty={p.qty} rsvp_qty_response={p.rsvp_qty_response} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <RsvpBadge status={p.rsvp_status} />
                    </td>
                    <td className="px-5 py-3.5 text-(--color-slate)">{formatDateTime(p.checked_in_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CARD VIEW MOBILE — read-only, ringkas tanpa tombol aksi (laporan bersifat lihat saja) */}
        {filtered.length === 0 ? (
          <p className="md:hidden px-5 py-10 text-center text-sm text-(--color-slate)">Tidak ada data yang cocok dengan pencarian atau filter ini.</p>
        ) : (
          <div className="md:hidden divide-y divide-(--color-border)">
            {filtered.map((p) => (
              <div key={p.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-(--color-ink)">{p.name}</p>
                    <p className="text-xs text-(--color-slate)">{formatPhoneDisplay(p.phone)}</p>
                  </div>
                  <p className="shrink-0 text-xs text-(--color-slate)">{formatDateTime(p.checked_in_at)}</p>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-(--color-slate)">Kursi {p.seat_number}</span>
                  <FamilyGroupBadge familyGroup={p.family_group} />
                  <QtyBadge qty={p.qty} rsvp_qty_response={p.rsvp_qty_response} />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <RsvpBadge status={p.rsvp_status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-(--color-slate)">
        Menampilkan {filtered.length} dari {participants.length} tiket terdaftar
      </p>
    </div>
  );
}
