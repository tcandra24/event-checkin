"use server";

import { createClient } from "@/lib/supabase/server";
import { generateParticipantCode, normalizePhone } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export interface ImportRow {
  name: string;
  phone: string;
  seat_number: string;
  family_group: string;
  qty: number;
}

export interface ImportRowResult {
  row: ImportRow;
  success: boolean;
  error?: string;
  phoneWarning?: string; // BARU — duplikat nomor HP terdeteksi, tapi tetap diimpor
}

export interface ImportResult {
  success: boolean;
  error?: string;
  totalRows?: number;
  totalSuccess?: number;
  totalFailed?: number;
  totalPhoneWarnings?: number; // BARU
  rowResults?: ImportRowResult[];
}

// Jumlah baris yang di-insert dalam satu kali pemanggilan ke Supabase.
// Dipilih cukup kecil untuk menjaga waktu eksekusi tiap batch tetap jauh
// di bawah limit Server Action, tapi cukup besar untuk memangkas jumlah
// round-trip jaringan dibanding insert satu-per-satu.
const INSERT_BATCH_SIZE = 50;

function validateRow(row: ImportRow): string | null {
  if (!row.name?.trim()) return "Nama wajib diisi.";
  if (!row.phone?.trim()) return "No HP wajib diisi.";
  if (!row.seat_number?.trim()) return "Nomor kursi wajib diisi.";
  if (!row.family_group?.trim()) return "Keluarga wajib diisi.";
  if (!Number.isFinite(row.qty) || row.qty < 1) return "Qty minimal 1.";
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

interface PreparedRow {
  row: ImportRow;
  code: string;
  phoneWarning?: string;
  insertPayload: {
    name: string;
    phone: string;
    seat_number: string;
    family_group: string;
    qty: number;
    code: string;
    created_by: string;
  };
}

/**
 * Import peserta secara massal dari hasil parsing Excel (dilakukan di sisi
 * client). Berbeda dari versi sebelumnya yang insert satu baris per request
 * (lambat dan rawan timeout untuk file besar), versi ini:
 *
 * 1. Memvalidasi SEMUA baris dan menyiapkan kode unik untuk SEMUA baris
 *    yang lolos validasi terlebih dahulu (tanpa menyentuh database sama
 *    sekali di langkah ini, kecuali query untuk daftar kode & nomor HP
 *    yang sudah dipakai).
 * 2. Mengecek duplikasi nomor HP — baik terhadap peserta yang SUDAH ADA
 *    di database, maupun ANTAR-BARIS di dalam file yang sama. Duplikat
 *    TIDAK memblokir import (ada kasus sah seperti satu nomor dipakai
 *    untuk mendaftarkan beberapa anggota keluarga sekaligus), tapi
 *    ditandai sebagai peringatan (`phoneWarning`) di hasil akhir supaya
 *    panitia bisa meninjau ulang jika itu tidak disengaja.
 * 3. Meng-insert baris yang sudah disiapkan itu per KELOMPOK (batch) berisi
 *    hingga 50 baris sekaligus dalam satu pemanggilan `insert()` — bukan
 *    satu per satu. Untuk 500 baris valid, ini memangkas jumlah request ke
 *    Supabase dari 500x menjadi sekitar 10x.
 * 4. Jika satu batch gagal (misal karena salah satu barisnya melanggar
 *    constraint), batch tersebut otomatis di-insert ulang satu per satu
 *    HANYA untuk batch itu — supaya baris yang valid di batch yang sama
 *    tetap tersimpan, dan baris yang benar-benar bermasalah tetap bisa
 *    diidentifikasi secara spesifik di hasil akhir (bukan cuma "batch ke-N
 *    gagal" tanpa detail).
 */
export async function importParticipants(rows: ImportRow[]): Promise<ImportResult> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, error: "Sesi habis, silakan login kembali." };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: "Tidak ada data untuk diimpor." };
  }

  if (rows.length > 1000) {
    return {
      success: false,
      error: "Maksimal 1000 baris per sekali import. Bagi file menjadi beberapa batch.",
    };
  }

  const rowResults: ImportRowResult[] = [];

  // === Langkah 1: validasi semua baris & siapkan kode unik di awal ===
  // Dilakukan murni di memori (tanpa query berulang ke database di tengah
  // proses), supaya langkah insert berikutnya bisa fokus murni pada I/O
  // database tanpa bercampur dengan logic validasi/generate kode.
  const { data: existingCodes } = await supabase.from("participants").select("code");
  const usedCodes = new Set((existingCodes ?? []).map((r) => r.code));

  // Ambil semua nomor HP yang sudah ada di database (sudah dinormalisasi
  // saat tersimpan), untuk dicocokkan dengan nomor pada baris yang akan
  // diimpor. Dipetakan ke nama pemiliknya supaya pesan peringatan lebih
  // informatif ("sama dengan nomor milik Budi Santoso").
  const { data: existingPhones } = await supabase.from("participants").select("phone, name");
  const phoneToExistingName = new Map<string, string>((existingPhones ?? []).map((p) => [p.phone, p.name]));

  // Melacak nomor yang sudah muncul DI DALAM file yang sedang diimpor ini,
  // supaya duplikat antar-baris (bukan cuma terhadap data lama) ikut
  // terdeteksi. Disimpan terpisah dari phoneToExistingName karena baris
  // pertama yang memakai suatu nomor tidak boleh "memperingatkan dirinya
  // sendiri" — hanya baris kedua dst. dengan nomor yang sama yang ditandai.
  const phonesSeenInThisImport = new Map<string, string>();

  const prepared: PreparedRow[] = [];

  for (const row of rows) {
    const validationError = validateRow(row);
    if (validationError) {
      rowResults.push({ row, success: false, error: validationError });
      continue;
    }

    let code = generateParticipantCode();
    let attempts = 0;
    while (usedCodes.has(code) && attempts < 10) {
      code = generateParticipantCode();
      attempts++;
    }
    usedCodes.add(code);

    const normalizedPhone = normalizePhone(row.phone);
    let phoneWarning: string | undefined;

    if (phoneToExistingName.has(normalizedPhone)) {
      phoneWarning = `Nomor sama dengan peserta lama: ${phoneToExistingName.get(normalizedPhone)}`;
    } else if (phonesSeenInThisImport.has(normalizedPhone)) {
      phoneWarning = `Nomor sama dengan baris lain di file ini: ${phonesSeenInThisImport.get(normalizedPhone)}`;
    } else {
      phonesSeenInThisImport.set(normalizedPhone, row.name.trim());
    }

    prepared.push({
      row,
      code,
      phoneWarning,
      insertPayload: {
        name: row.name.trim(),
        phone: normalizedPhone,
        seat_number: row.seat_number.trim(),
        family_group: row.family_group.trim(),
        qty: Math.round(row.qty),
        code,
        created_by: userData.user.id,
      },
    });
  }

  // === Langkah 2: insert per-batch ===
  const batches = chunk(prepared, INSERT_BATCH_SIZE);

  for (const batch of batches) {
    const { error: batchError } = await supabase.from("participants").insert(batch.map((p) => p.insertPayload));

    if (!batchError) {
      // Seluruh batch berhasil — tandai semua baris di batch ini sukses,
      // tetap bawa phoneWarning (jika ada) supaya tampil di hasil akhir.
      for (const p of batch) {
        rowResults.push({ row: p.row, success: true, phoneWarning: p.phoneWarning });
      }
      continue;
    }

    // Batch ini gagal (misal salah satu barisnya melanggar constraint).
    // Insert ulang HANYA untuk batch ini, satu per satu, supaya baris yang
    // sebenarnya valid di batch yang sama tetap tersimpan, dan baris yang
    // benar-benar bermasalah bisa diidentifikasi secara spesifik.
    for (const p of batch) {
      const { error: singleError } = await supabase.from("participants").insert(p.insertPayload);

      if (singleError) {
        rowResults.push({ row: p.row, success: false, error: singleError.message });
      } else {
        rowResults.push({ row: p.row, success: true, phoneWarning: p.phoneWarning });
      }
    }
  }

  const totalSuccess = rowResults.filter((r) => r.success).length;
  const totalFailed = rowResults.filter((r) => !r.success).length;
  const totalPhoneWarnings = rowResults.filter((r) => r.phoneWarning).length;

  revalidatePath("/peserta");
  revalidatePath("/laporan");

  return {
    success: true,
    totalRows: rows.length,
    totalSuccess,
    totalFailed,
    totalPhoneWarnings,
    rowResults,
  };
}
