"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  QrCode,
  Pencil,
  Trash2,
  Send,
  Users,
  RotateCcw,
} from "lucide-react";
import type { Participant } from "@/lib/types";
import { StatusBadge, CategoryBadge } from "@/components/Badges";
import { formatPhoneDisplay } from "@/lib/utils";
import { ParticipantFormModal } from "@/components/ParticipantFormModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { QrCardModal } from "@/components/QrCardModal";
import { BroadcastModal } from "@/components/BroadcastModal";
import { resetParticipantStatus } from "@/app/actions/participants";

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; participant: Participant }
  | { type: "delete"; participant: Participant }
  | { type: "qr"; participant: Participant }
  | { type: "broadcast" };

export function ParticipantsClient({
  initialParticipants,
}: {
  initialParticipants: Participant[];
}) {
  const router = useRouter();
  const participants = initialParticipants;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "VIP" | "Umum">("all");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [, startTransition] = useTransition();

  function refresh() {
    setModal({ type: "none" });
    startTransition(() => router.refresh());
  }

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search) ||
        (p.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [participants, search, categoryFilter]);

  async function handleResetStatus(p: Participant) {
    await resetParticipantStatus(p.id);
    refresh();
  }

  return (
    <div className="px-8 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--color-ink)">
            Input Peserta Undangan
          </h1>
          <p className="mt-1 text-sm text-(--color-slate)">
            Kelola data peserta dan QR code identitas masing-masing.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => setModal({ type: "broadcast" })}
            className="flex items-center gap-2 rounded-lg border border-(--color-border) bg-white px-4 py-2.5 text-sm font-semibold text-(--color-ink) shadow-sm hover:bg-slate-50"
          >
            <Send className="h-4 w-4" />
            Broadcast WA
          </button>
          <button
            onClick={() => setModal({ type: "create" })}
            className="flex items-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Tambah Peserta
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-slate-light)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, HP, instansi, atau kode..."
            className="w-full rounded-lg border border-(--color-border) bg-white py-2.5 pl-9 pr-3 text-sm focus:border-(--color-ink) focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1">
          {(["all", "VIP", "Umum"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setCategoryFilter(opt)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                categoryFilter === opt
                  ? "bg-white text-(--color-ink) shadow-sm"
                  : "text-(--color-slate)"
              }`}
            >
              {opt === "all" ? "Semua" : opt}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-(--color-border) bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Users className="h-6 w-6 text-(--color-slate-light)" />
            </div>
            <p className="mt-3 font-display text-sm font-semibold text-(--color-ink)">
              {participants.length === 0
                ? "Belum ada peserta terdaftar"
                : "Tidak ada peserta yang cocok"}
            </p>
            <p className="mt-1 text-sm text-(--color-slate)">
              {participants.length === 0
                ? "Tambahkan peserta pertama untuk mulai membuat QR code undangan."
                : "Coba ubah kata pencarian atau filter kategori."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto thin-scrollbar">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-(--color-border) bg-slate-50 text-xs uppercase tracking-wide text-(--color-slate)">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Kontak</th>
                  <th className="px-5 py-3 font-medium">Instansi</th>
                  <th className="px-5 py-3 font-medium">Kategori</th>
                  <th className="px-5 py-3 font-medium">Status</th>
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
                    <td className="px-5 py-3.5 text-(--color-slate)">
                      {formatPhoneDisplay(p.phone)}
                    </td>
                    <td className="px-5 py-3.5 text-(--color-slate)">{p.company || "—"}</td>
                    <td className="px-5 py-3.5">
                      <CategoryBadge category={p.category} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setModal({ type: "qr", participant: p })}
                          title="Lihat QR code"
                          className="rounded-md p-2 text-(--color-slate) hover:bg-slate-100 hover:text-(--color-ink)"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        {p.status === "hadir" && (
                          <button
                            onClick={() => handleResetStatus(p)}
                            title="Reset status jadi belum hadir"
                            className="rounded-md p-2 text-(--color-slate) hover:bg-slate-100 hover:text-(--color-ink)"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ type: "edit", participant: p })}
                          title="Ubah data"
                          className="rounded-md p-2 text-(--color-slate) hover:bg-slate-100 hover:text-(--color-ink)"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", participant: p })}
                          title="Hapus"
                          className="rounded-md p-2 text-(--color-slate) hover:bg-red-50 hover:text-red-600"
                        >
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
      </div>

      <p className="mt-3 text-xs text-(--color-slate)">
        Menampilkan {filtered.length} dari {participants.length} peserta
      </p>

      {modal.type === "create" && (
        <ParticipantFormModal onClose={() => setModal({ type: "none" })} onSaved={refresh} />
      )}
      {modal.type === "edit" && (
        <ParticipantFormModal
          participant={modal.participant}
          onClose={() => setModal({ type: "none" })}
          onSaved={refresh}
        />
      )}
      {modal.type === "delete" && (
        <ConfirmDeleteModal
          participantId={modal.participant.id}
          participantName={modal.participant.name}
          onClose={() => setModal({ type: "none" })}
          onDeleted={refresh}
        />
      )}
      {modal.type === "qr" && (
        <QrCardModal participant={modal.participant} onClose={() => setModal({ type: "none" })} />
      )}
      {modal.type === "broadcast" && (
        <BroadcastModal onClose={() => setModal({ type: "none" })} />
      )}
    </div>
  );
}
