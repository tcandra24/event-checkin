"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, ClipboardList, QrCode, LogOut, CalendarDays, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/peserta", label: "Input Peserta", icon: Users },
  { href: "/laporan", label: "Laporan Kehadiran", icon: ClipboardList },
  { href: "/scan", label: "Scan QR Code", icon: QrCode },
  { href: "/pengaturan", label: "Pengaturan Tiket", icon: Settings },
];

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 flex-col bg-(--color-ink) text-white">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold leading-tight">{process.env.NEXT_PUBLIC_EVENT_NAME || "Event Check-in"}</p>
          <p className="text-[11px] text-white/50">Panel Panitia</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-white text-(--color-ink)" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        {userEmail && <p className="truncate px-3 pb-2 text-xs text-white/40">{userEmail}</p>}
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          Keluar
        </button>
      </div>
    </aside>
  );
}
