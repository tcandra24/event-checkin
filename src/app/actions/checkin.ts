"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Participant } from "@/lib/types";

export interface ScanResult {
  success: boolean;
  error?: string;
  alreadyCheckedIn?: boolean;
  participant?: Participant;
}

/**
 * Menerima isi QR code (bisa berupa code mentah "EVT-XXXXXXXX"
 * atau URL "https://domain.com/c/EVT-XXXXXXXX") lalu mengekstrak code-nya.
 */
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/EVT-[A-Z0-9]{6,10}/i);
  if (match) return match[0].toUpperCase();
  return trimmed.toUpperCase();
}

export async function checkInByCode(rawCode: string): Promise<ScanResult> {
  const supabase = await createClient();
  const code = extractCode(rawCode);

  const { data: participant, error: findError } = await supabase.from("participants").select("*").eq("code", code).maybeSingle();

  if (findError) {
    return { success: false, error: findError.message };
  }

  if (!participant) {
    return {
      success: false,
      error: "Kode QR tidak ditemukan dalam daftar peserta.",
    };
  }

  // PENTING: pengecekan "sudah hadir atau belum" dan perubahan statusnya
  // digabung menjadi SATU operasi UPDATE atomik (bersyarat WHERE status =
  // 'belum_hadir'), bukan dua langkah terpisah (SELECT lalu UPDATE).
  //
  // Tanpa ini, ada celah race condition: jika dua panitia/device melakukan
  // scan untuk QR yang sama dalam waktu yang hampir bersamaan, KEDUANYA
  // bisa lolos pengecekan "status masih belum_hadir" sebelum salah satu
  // sempat menuliskan perubahannya — menyebabkan proses check-in berjalan
  // dua kali untuk satu tiket yang sama.
  //
  // Dengan WHERE status = 'belum_hadir' di klausa UPDATE, PostgreSQL
  // menjamin row-level locking otomatis: dari sekian request yang datang
  // bersamaan untuk baris yang sama, hanya SATU yang berhasil mengubah
  // status (karena begitu satu transaksi berhasil mengubahnya menjadi
  // 'hadir', kondisi WHERE untuk request lain otomatis tidak lagi
  // terpenuhi). Request lain akan mendapati 0 baris berubah, bukan ikut
  // "berhasil" memproses check-in yang sama.
  const { data: updated, error: updateError } = await supabase.from("participants").update({ status: "hadir", checked_in_at: new Date().toISOString() }).eq("id", participant.id).eq("status", "belum_hadir").select("*").maybeSingle();

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (!updated) {
    // Tidak ada baris yang berubah — artinya kondisi `status = 'belum_hadir'`
    // sudah tidak terpenuhi saat UPDATE ini dieksekusi. Ini bisa terjadi
    // karena peserta memang sudah di-check-in sebelumnya, ATAU karena
    // request lain berhasil mengubahnya tepat sebelum request ini (race
    // condition yang berhasil dicegah). Ambil data terbaru untuk
    // ditampilkan sebagai "sudah check-in sebelumnya" — perilaku yang
    // sama persis baik untuk kasus normal maupun kasus race condition,
    // sehingga aman ditangani dengan cara yang sama.
    const { data: latest, error: latestError } = await supabase.from("participants").select("*").eq("id", participant.id).single();

    if (latestError || !latest) {
      return { success: false, error: "Gagal memuat data peserta terbaru." };
    }

    return {
      success: true,
      alreadyCheckedIn: true,
      participant: latest as Participant,
    };
  }

  revalidatePath("/laporan");
  revalidatePath("/peserta");

  return {
    success: true,
    alreadyCheckedIn: false,
    participant: updated as Participant,
  };
}
