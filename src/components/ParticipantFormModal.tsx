"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Participant, ParticipantCategory } from "@/lib/types";
import { createParticipant, updateParticipant } from "@/app/actions/participants";

export function ParticipantFormModal({
  participant,
  onClose,
  onSaved,
}: {
  participant?: Participant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!participant;
  const [name, setName] = useState(participant?.name ?? "");
  const [phone, setPhone] = useState(participant?.phone ?? "");
  const [company, setCompany] = useState(participant?.company ?? "");
  const [category, setCategory] = useState<ParticipantCategory>(
    participant?.category ?? "Umum"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = isEdit
      ? await updateParticipant(participant!.id, { name, phone, company, category })
      : await createParticipant({ name, phone, company, category });

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Terjadi kesalahan, coba lagi.");
      return;
    }

    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-(--color-border) px-6 py-4">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">
            {isEdit ? "Ubah Data Peserta" : "Tambah Peserta Baru"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-(--color-slate) hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Nama lengkap
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Nomor WhatsApp
              </label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08123456789"
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Instansi / Perusahaan
              </label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Opsional"
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm focus:border-(--color-ink) focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-(--color-ink)">
                Kategori tamu
              </label>
              <div className="flex gap-2">
                {(["Umum", "VIP"] as ParticipantCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex-1 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      category === cat
                        ? "border-(--color-ink) bg-(--color-ink) text-white"
                        : "border-(--color-border) text-(--color-slate) hover:bg-slate-50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan perubahan" : "Tambah peserta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
