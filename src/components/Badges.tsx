import { Users } from "lucide-react";
import type { ParticipantStatus } from "@/lib/types";

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

export function FamilyGroupBadge({ familyGroup }: { familyGroup: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-(--color-vip-soft) px-2.5 py-1 text-xs font-semibold text-violet-700">
      {familyGroup}
    </span>
  );
}

export function QtyBadge({ qty }: { qty: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Users className="h-3 w-3" />
      {qty} pax
    </span>
  );
}
