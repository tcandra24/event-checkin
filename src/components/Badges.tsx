import { Users, Clock, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { ParticipantStatus, RsvpStatus } from "@/lib/types";

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
  return <span className="inline-flex items-center rounded-full bg-(--color-vip-soft) px-2.5 py-1 text-xs font-semibold text-violet-700">{familyGroup}</span>;
}

export function QtyBadge({ qty, rsvp_qty_response }: { qty: number; rsvp_qty_response: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Users className="h-3 w-3" />
      {rsvp_qty_response ? `${rsvp_qty_response} / ` : ""} {qty} pax
    </span>
  );
}

export function RsvpBadge({ status }: { status: RsvpStatus }) {
  switch (status) {
    case "menunggu_approval":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          <Clock className="h-3 w-3" />
          Menunggu approval
        </span>
      );
    case "dikonfirmasi_hadir":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-emerald-soft) px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          RSVP: Hadir
        </span>
      );
    case "dikonfirmasi_tidak_hadir":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-500">
          <XCircle className="h-3 w-3" />
          RSVP: Tidak hadir
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-400">
          <HelpCircle className="h-3 w-3" />
          Belum konfirmasi
        </span>
      );
  }
}
