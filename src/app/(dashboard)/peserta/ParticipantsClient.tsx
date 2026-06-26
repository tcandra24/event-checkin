"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, QrCode, Pencil, Trash2, Send, Users, RotateCcw, Settings, FileSpreadsheet, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { Participant } from "@/lib/types";
import { StatusBadge, FamilyGroupBadge, QtyBadge, RsvpBadge } from "@/components/Badges";
import { formatPhoneDisplay } from "@/lib/utils";
import { ParticipantFormModal } from "@/components/ParticipantFormModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { QrCardModal } from "@/components/QrCardModal";
import { BroadcastModal } from "@/components/BroadcastModal";
import { ImportExcelModal } from "@/components/ImportExcelModal";
import { RsvpReviewModal } from "@/components/RsvpReviewModal";
import { resetParticipantStatus } from "@/app/actions/participants";

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; participant: Participant }
  | { type: "delete"; participant: Participant }
  | { type: "qr"; participant: Participant }
  | { type: "broadcast" }
  | { type: "import" }
  | { type: "rsvp-review"; participant: Participant };

export function ParticipantsClient({ initialParticipants }: { initialParticipants: Participant[] }) {
  const router = useRouter();
  const participants = initialParticipants;
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [rsvpFilter, setRsvpFilter] = useState<string>("all");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [, startTransition] = useTransition();

  function refresh() {
    setModal({ type: "none" });
    startTransition(() => router.refresh());
  }

  const familyOptions = useMemo(() => {
    return Array.from(new Set(participants.map((p) => p.family_group))).sort();
  }, [participants]);

  const pendingRsvpCount = useMemo(() => participants.filter((p) => p.rsvp_status === "menunggu_approval").length, [participants]);

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search) ||
        p.seat_number.toLowerCase().includes(search.toLowerCase()) ||
        p.family_group.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());
      const matchFamily = familyFilter === "all" || p.family_group === familyFilter;
      const matchRsvp = rsvpFilter === "all" || p.rsvp_status === rsvpFilter;
      return matchSearch && matchFamily && matchRsvp;
    });
  }, [participants, search, familyFilter, rsvpFilter]);

  const totalPax = useMemo(() => filtered.reduce((sum, p) => sum + p.qty, 0), [filtered]);

  async function handleResetStatus(p: Participant) {
    await resetParticipantStatus(p.id);
    refresh();
  }

  return (
    <div className="px-8 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--color-ink)">Input Peserta Undangan</h1>
          <p className="mt-1 text-sm text-(--color-slate)">Kelola data peserta dan QR code identitas masing-masing.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/pengaturan" className="flex items-center gap-2 rounded-lg border border-(--color-border) bg-white px-4 py-2.5 text-sm font-semibold text-(--color-ink) shadow-sm hover:bg-slate-50">
            <Settings className="h-4 w-4" />
            Pengaturan Tiket
          </Link>
          <button onClick={() => setModal({ type: "import" })} className="flex items-center gap-2 rounded-lg border border-(--color-border) bg-white px-4 py-2.5 text-sm font-semibold text-(--color-ink) shadow-sm hover:bg-slate-50">
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel
          </button>
          <button onClick={() => setModal({ type: "broadcast" })} className="flex items-center gap-2 rounded-lg border border-(--color-border) bg-white px-4 py-2.5 text-sm font-semibold text-(--color-ink) shadow-sm hover:bg-slate-50">
            <Send className="h-4 w-4" />
            Broadcast WA
          </button>
          <button onClick={() => setModal({ type: "create" })} className="flex items-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" />
            Tambah Peserta
          </button>
        </div>
      </div>

      {pendingRsvpCount > 0 && (
        <button onClick={() => setRsvpFilter("menunggu_approval")} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100">
          <ClipboardCheck className="h-5 w-5 shrink-0 text-blue-600" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{pendingRsvpCount} konfirmasi kehadiran</span> menunggu persetujuanmu. Klik untuk meninjau.
          </p>
        </button>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-60 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-slate-light)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, HP, kursi, keluarga, atau kode..."
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
        <select value={rsvpFilter} onChange={(e) => setRsvpFilter(e.target.value)} className="rounded-lg border border-(--color-border) bg-white px-3 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none">
          <option value="all">Semua status RSVP</option>
          <option value="belum_konfirmasi">Belum konfirmasi</option>
          <option value="menunggu_approval">Menunggu approval</option>
          <option value="dikonfirmasi_hadir">RSVP: Hadir</option>
          <option value="dikonfirmasi_tidak_hadir">RSVP: Tidak hadir</option>
        </select>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-(--color-border) bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Users className="h-6 w-6 text-(--color-slate-light)" />
            </div>
            <p className="mt-3 font-display text-sm font-semibold text-(--color-ink)">{participants.length === 0 ? "Belum ada peserta terdaftar" : "Tidak ada peserta yang cocok"}</p>
            <p className="mt-1 text-sm text-(--color-slate)">{participants.length === 0 ? "Tambahkan peserta pertama atau import dari Excel untuk mulai membuat QR code undangan." : "Coba ubah kata pencarian atau filter."}</p>
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto thin-scrollbar">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-(--color-border) bg-slate-50 text-xs uppercase tracking-wide text-(--color-slate)">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Kontak</th>
                  <th className="px-5 py-3 font-medium">Kursi</th>
                  <th className="px-5 py-3 font-medium">Keluarga</th>
                  <th className="px-5 py-3 font-medium">Qty</th>
                  <th className="px-5 py-3 font-medium">Kehadiran</th>
                  <th className="px-5 py-3 font-medium">RSVP</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-(--color-ink)">{p.name}</p>
                      <p className="font-mono text-xs text-(--color-slate-light)">{p.code}</p>
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
                      <button
                        onClick={() => (p.rsvp_status === "menunggu_approval" ? setModal({ type: "rsvp-review", participant: p }) : undefined)}
                        className={p.rsvp_status === "menunggu_approval" ? "cursor-pointer" : ""}
                        title={p.rsvp_status === "menunggu_approval" ? "Klik untuk meninjau konfirmasi" : undefined}
                      >
                        <RsvpBadge status={p.rsvp_status} />
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setModal({ type: "qr", participant: p })} title="Lihat tiket QR" className="rounded-md p-2 text-(--color-slate) hover:bg-slate-100 hover:text-(--color-ink)">
                          <QrCode className="h-4 w-4" />
                        </button>
                        {p.status === "hadir" && (
                          <button onClick={() => handleResetStatus(p)} title="Reset status jadi belum hadir" className="rounded-md p-2 text-(--color-slate) hover:bg-slate-100 hover:text-(--color-ink)">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => setModal({ type: "edit", participant: p })} title="Ubah data" className="rounded-md p-2 text-(--color-slate) hover:bg-slate-100 hover:text-(--color-ink)">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setModal({ type: "delete", participant: p })} title="Hapus" className="rounded-md p-2 text-(--color-slate) hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CARD VIEW MOBILE — tampil hanya di bawah md, menggantikan tabel */}
        {filtered.length > 0 && (
          <div className="md:hidden divide-y divide-(--color-border)">
            {filtered.map((p) => (
              <div key={p.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-(--color-ink)">{p.name}</p>
                    <p className="font-mono text-xs text-(--color-slate-light)">{p.code}</p>
                    <p className="mt-0.5 text-xs text-(--color-slate)">{formatPhoneDisplay(p.phone)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setModal({ type: "qr", participant: p })} title="Lihat tiket QR" className="rounded-md p-2 text-(--color-slate) hover:bg-slate-100">
                      <QrCode className="h-4 w-4" />
                    </button>
                    <button onClick={() => setModal({ type: "edit", participant: p })} title="Ubah data" className="rounded-md p-2 text-(--color-slate) hover:bg-slate-100">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setModal({ type: "delete", participant: p })} title="Hapus" className="rounded-md p-2 text-(--color-slate) hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-(--color-slate)">Kursi {p.seat_number}</span>
                  <FamilyGroupBadge familyGroup={p.family_group} />
                  <QtyBadge qty={p.qty} rsvp_qty_response={p.rsvp_qty_response} />
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <button onClick={() => (p.rsvp_status === "menunggu_approval" ? setModal({ type: "rsvp-review", participant: p }) : undefined)}>
                    <RsvpBadge status={p.rsvp_status} />
                  </button>
                  {p.status === "hadir" && (
                    <button onClick={() => handleResetStatus(p)} className="ml-auto rounded-md p-1.5 text-(--color-slate) hover:bg-slate-100" title="Reset status jadi belum hadir">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-(--color-slate)">
        Menampilkan {filtered.length} dari {participants.length} tiket/QR · total {totalPax} tamu
      </p>

      {modal.type === "create" && <ParticipantFormModal onClose={() => setModal({ type: "none" })} onSaved={refresh} />}
      {modal.type === "edit" && <ParticipantFormModal participant={modal.participant} onClose={() => setModal({ type: "none" })} onSaved={refresh} />}
      {modal.type === "delete" && <ConfirmDeleteModal participantId={modal.participant.id} participantName={modal.participant.name} onClose={() => setModal({ type: "none" })} onDeleted={refresh} />}
      {modal.type === "qr" && <QrCardModal participant={modal.participant} onClose={() => setModal({ type: "none" })} />}
      {modal.type === "broadcast" && <BroadcastModal onClose={() => setModal({ type: "none" })} familyOptions={familyOptions} />}
      {modal.type === "import" && <ImportExcelModal onClose={() => setModal({ type: "none" })} onImported={refresh} />}
      {modal.type === "rsvp-review" && <RsvpReviewModal participant={modal.participant} onClose={() => setModal({ type: "none" })} onReviewed={refresh} />}
    </div>
  );
}
