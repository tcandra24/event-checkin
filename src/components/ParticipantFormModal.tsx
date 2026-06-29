"use client";

import { useState } from "react";
import { Loader2, X, Minus, Plus } from "lucide-react";
import type { Participant } from "@/lib/types";
import { createParticipant, updateParticipant, type ParticipantFormInput } from "@/app/actions/participants";

export function ParticipantFormModal({ participant, onClose, onSaved }: { participant?: Participant | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!participant;
  const [name, setName] = useState(participant?.name ?? "");
  const [phone, setPhone] = useState(participant?.phone ?? "");
  const [seatNumber, setSeatNumber] = useState(participant?.seat_number ?? "");
  const [familyGroup, setFamilyGroup] = useState(participant?.family_group ?? "");
  const [qty, setQty] = useState(participant?.qty ?? 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function adjustQty(delta: number) {
    setQty((prev) => Math.max(1, prev + delta));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const input: ParticipantFormInput = {
      name,
      phone,
      seat_number: seatNumber,
      family_group: familyGroup,
      qty,
    };

    const result = isEdit ? await updateParticipant(participant!.id, input) : await createParticipant(input);

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Terjadi kesalahan, coba lagi.");
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-(--color-border) px-6 py-4">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">{isEdit ? "Ubah Data Peserta" : "Tambah Peserta Baru"}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-(--color-slate) hover:bg-slate-100" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Nama lengkap</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Nomor WhatsApp</label>
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08123456789" className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Kursi / Meja</label>
                <input
                  required
                  value={seatNumber}
                  onChange={(e) => setSeatNumber(e.target.value)}
                  placeholder="Contoh: A12 atau Meja 5"
                  className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Keluarga / rombongan</label>
                <input
                  required
                  value={familyGroup}
                  onChange={(e) => setFamilyGroup(e.target.value)}
                  placeholder="Contoh: Keluarga Santoso"
                  className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
                />
              </div>
            </div>
            <p className="mt-1.5! text-xs text-(--color-slate)">
              Isi dengan nomor kursi individual (misal &quot;A12&quot;) atau nomor meja jika beberapa tamu duduk bersama (misal &quot;Meja 5&quot;) — keduanya dipakai untuk mengelompokkan peserta di laporan dan saat broadcast WhatsApp.
            </p>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">Jumlah pax (qty tiket)</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => adjustQty(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--color-border) text-(--color-ink) hover:bg-slate-50" aria-label="Kurangi jumlah pax">
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-(--color-border) px-3 py-2.5 text-center text-sm focus:border-(--color-ink) focus:outline-none"
                />
                <button type="button" onClick={() => adjustQty(1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--color-border) text-(--color-ink) hover:bg-slate-50" aria-label="Tambah jumlah pax">
                  <Plus className="h-4 w-4" />
                </button>
                <p className="text-xs text-(--color-slate)">1 QR code berlaku untuk {qty} orang</p>
              </div>
            </div>
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan perubahan" : "Tambah peserta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
