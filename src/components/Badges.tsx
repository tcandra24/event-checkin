import type { ParticipantStatus, ParticipantCategory } from "@/lib/types";

export function StatusBadge({ status }: { status: ParticipantStatus }) {
  if (status === "hadir") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-emerald-soft) px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-(--color-emerald)" />
        Hadir
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-amber-soft) px-2.5 py-1 text-xs font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-(--color-amber)" />
      Belum hadir
    </span>
  );
}

export function CategoryBadge({ category }: { category: ParticipantCategory }) {
  if (category === "VIP") {
    return (
      <span className="inline-flex items-center rounded-full bg-(--color-vip-soft) px-2.5 py-1 text-xs font-semibold text-violet-700">
        VIP
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      Umum
    </span>
  );
}
