import { createClient } from "@/lib/supabase/server";
import { LaporanClient } from "./LaporanClient";

export default async function LaporanPage() {
  const supabase = await createClient();
  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .order("checked_in_at", { ascending: false, nullsFirst: false });

  return <LaporanClient participants={participants ?? []} />;
}
