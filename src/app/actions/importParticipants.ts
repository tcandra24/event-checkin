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
}

export interface ImportResult {
  success: boolean;
  error?: string;
  totalRows?: number;
  totalSuccess?: number;
  totalFailed?: number;
  rowResults?: ImportRowResult[];
}

function validateRow(row: ImportRow): string | null {
  if (!row.name?.trim()) return "Nama wajib diisi.";
  if (!row.phone?.trim()) return "No HP wajib diisi.";
  if (!row.seat_number?.trim()) return "Nomor kursi wajib diisi.";
  if (!row.family_group?.trim()) return "Keluarga wajib diisi.";
  if (!Number.isFinite(row.qty) || row.qty < 1) return "Qty minimal 1.";
  return null;
}

/**
 * Import peserta secara massal dari hasil parsing Excel (dilakukan di sisi
 * client). Setiap baris diberi kode unik baru, divalidasi, lalu di-insert
 * satu per satu agar baris yang gagal tidak menggagalkan seluruh batch.
 */
export async function importParticipants(
  rows: ImportRow[]
): Promise<ImportResult> {
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
  let totalSuccess = 0;
  let totalFailed = 0;

  // Ambil semua kode yang sudah ada sekali saja di awal, supaya tidak perlu
  // query berulang untuk cek keunikan kode pada setiap baris.
  const { data: existingCodes } = await supabase
    .from("participants")
    .select("code");
  const usedCodes = new Set((existingCodes ?? []).map((r) => r.code));

  for (const row of rows) {
    const validationError = validateRow(row);
    if (validationError) {
      rowResults.push({ row, success: false, error: validationError });
      totalFailed++;
      continue;
    }

    let code = generateParticipantCode();
    let attempts = 0;
    while (usedCodes.has(code) && attempts < 10) {
      code = generateParticipantCode();
      attempts++;
    }
    usedCodes.add(code);

    const { error } = await supabase.from("participants").insert({
      name: row.name.trim(),
      phone: normalizePhone(row.phone),
      seat_number: row.seat_number.trim(),
      family_group: row.family_group.trim(),
      qty: Math.round(row.qty),
      code,
      created_by: userData.user.id,
    });

    if (error) {
      rowResults.push({ row, success: false, error: error.message });
      totalFailed++;
    } else {
      rowResults.push({ row, success: true });
      totalSuccess++;
    }
  }

  revalidatePath("/peserta");
  revalidatePath("/laporan");

  return {
    success: true,
    totalRows: rows.length,
    totalSuccess,
    totalFailed,
    rowResults,
  };
}
