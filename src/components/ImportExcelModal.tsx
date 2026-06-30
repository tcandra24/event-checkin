"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { X, Download, Upload, Loader2, CheckCircle2, AlertCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { importParticipants, type ImportRow, type ImportRowResult } from "@/app/actions/importParticipants";

const TEMPLATE_HEADERS = ["Nama", "No HP", "Kursi/Meja", "Keluarga", "Qty"];

type ParsedRow = ImportRow & { rowNumber: number; parseError?: string };

function downloadTemplate() {
  const sampleRows = [
    ["Budi Santoso", "08123456789", "A1", "Keluarga Santoso", 2],
    ["Siti Aminah", "08129876543", "A2", "Keluarga Santoso", 1],
  ];
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...sampleRows]);
  ws["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Peserta");
  XLSX.writeFile(wb, "template-import-peserta.xlsx");
}

function parseWorkbook(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
        });

        const parsed: ParsedRow[] = rows.map((r, idx) => {
          const get = (...keys: string[]): string => {
            for (const k of keys) {
              const found = Object.keys(r).find((key) => key.trim().toLowerCase() === k.toLowerCase());
              if (found && r[found] !== undefined && r[found] !== "") {
                return String(r[found]).trim();
              }
            }
            return "";
          };

          const name = get("Nama", "Name");
          const phone = get("No HP", "No. HP", "Nomor HP", "Phone", "HP");
          const seatNumber = get("Kursi/Meja", "Nomor Kursi", "Kursi", "Meja", "Nomor Meja", "Seat Number", "Seat");
          const familyGroup = get("Keluarga", "Family", "Family Group", "Rombongan");
          const qtyRaw = get("Qty", "Jumlah", "Pax");
          const qty = qtyRaw ? parseInt(qtyRaw, 10) : 1;

          let parseError: string | undefined;
          if (!name) parseError = "Nama kosong";
          else if (!phone) parseError = "No HP kosong";
          else if (!seatNumber) parseError = "Kursi/Meja kosong";
          else if (!familyGroup) parseError = "Keluarga kosong";
          else if (!Number.isFinite(qty) || qty < 1) parseError = "Qty tidak valid";

          return {
            rowNumber: idx + 2, // +2 karena baris 1 adalah header
            name,
            phone,
            seat_number: seatNumber,
            family_group: familyGroup,
            qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
            parseError,
          };
        });

        resolve(parsed);
      } catch {
        reject(new Error("Gagal membaca file. Pastikan format file adalah .xlsx atau .xls."));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsBinaryString(file);
  });
}

export function ImportExcelModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseFileError, setParseFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [rowResults, setRowResults] = useState<ImportRowResult[]>([]);
  const [summary, setSummary] = useState<{
    success: number;
    failed: number;
    phoneWarnings: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = parsedRows.filter((r) => !r.parseError);
  const invalidRows = parsedRows.filter((r) => r.parseError);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseFileError(null);
    try {
      const rows = await parseWorkbook(file);
      if (rows.length === 0) {
        setParseFileError("File kosong atau tidak ada data yang terbaca.");
        return;
      }
      setParsedRows(rows);
      setStep("preview");
    } catch (err) {
      setParseFileError(err instanceof Error ? err.message : "Gagal membaca file.");
    }
  }

  async function handleConfirmImport() {
    setImporting(true);
    const result = await importParticipants(
      validRows.map((r) => ({
        name: r.name,
        phone: r.phone,
        seat_number: r.seat_number,
        family_group: r.family_group,
        qty: r.qty,
      })),
    );
    setImporting(false);

    if (!result.success) {
      setParseFileError(result.error ?? "Gagal mengimpor data.");
      return;
    }

    setRowResults(result.rowResults ?? []);
    setSummary({
      success: result.totalSuccess ?? 0,
      failed: result.totalFailed ?? 0,
      phoneWarnings: result.totalPhoneWarnings ?? 0,
    });
    setStep("result");
  }

  function handleFinish() {
    onImported();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={step === "upload" ? onClose : undefined}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl thin-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-(--color-border) px-6 py-4">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">Import Peserta dari Excel</h2>
          <button onClick={onClose} className="rounded-full p-1 text-(--color-slate) hover:bg-slate-100" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "upload" && (
          <div className="px-6 py-6">
            <div className="rounded-xl border border-dashed border-(--color-border) bg-slate-50 p-6 text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-(--color-slate-light)" />
              <p className="mt-3 text-sm text-(--color-slate)">Unggah file Excel (.xlsx/.xls) berisi data peserta sesuai format template.</p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="mt-4 flex items-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 mx-auto">
                <Upload className="h-4 w-4" />
                Pilih file Excel
              </button>
            </div>

            {parseFileError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{parseFileError}</p>}

            <div className="mt-5 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-blue-900">Belum punya template?</p>
                <p className="text-xs text-blue-700">Unduh template kosong dengan kolom yang sudah sesuai.</p>
              </div>
              <button onClick={downloadTemplate} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50">
                <Download className="h-3.5 w-3.5" />
                Unduh template
              </button>
            </div>

            <p className="mt-3 text-xs text-(--color-slate)">
              Kolom yang dibutuhkan: <strong>Nama</strong>, <strong>No HP</strong>, <strong>Kursi/Meja</strong> (isi nomor kursi individual atau nomor meja kelompok), <strong>Keluarga</strong>, <strong>Qty</strong> (jumlah pax per tiket, boleh
              dikosongkan = default 1).
            </p>
          </div>
        )}

        {step === "preview" && (
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg bg-(--color-emerald-soft) px-3 py-2 text-sm font-medium text-emerald-700">{validRows.length} baris valid</div>
              {invalidRows.length > 0 && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{invalidRows.length} baris bermasalah (akan dilewati)</div>}
            </div>

            <p className="mt-3 text-xs text-(--color-slate)">Duplikasi nomor HP (jika ada) baru terdeteksi setelah proses import berjalan, karena pengecekan dilakukan terhadap data yang sudah tersimpan di server.</p>

            <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-(--color-border) thin-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-(--color-border) text-xs uppercase tracking-wide text-(--color-slate)">
                    <th className="px-3 py-2 font-medium">Baris</th>
                    <th className="px-3 py-2 font-medium">Nama</th>
                    <th className="px-3 py-2 font-medium">No HP</th>
                    <th className="px-3 py-2 font-medium">Kursi/Meja</th>
                    <th className="px-3 py-2 font-medium">Keluarga</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border)">
                  {parsedRows.map((row) => (
                    <tr key={row.rowNumber} className={row.parseError ? "bg-red-50" : ""}>
                      <td className="px-3 py-2 text-(--color-slate)">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.name || "—"}</td>
                      <td className="px-3 py-2">{row.phone || "—"}</td>
                      <td className="px-3 py-2">{row.seat_number || "—"}</td>
                      <td className="px-3 py-2">{row.family_group || "—"}</td>
                      <td className="px-3 py-2">{row.qty}</td>
                      <td className="px-3 py-2">{row.parseError ? <span className="text-xs font-medium text-red-600">{row.parseError}</span> : <span className="text-xs font-medium text-emerald-600">Siap</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parseFileError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{parseFileError}</p>}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setStep("upload");
                  setParsedRows([]);
                }}
                disabled={importing}
                className="flex-1 rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-slate-50 disabled:opacity-60"
              >
                Pilih file lain
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || validRows.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {importing ? "Mengimpor..." : `Import ${validRows.length} peserta`}
              </button>
            </div>
          </div>
        )}

        {step === "result" && summary && (
          <div className="px-6 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-emerald-soft)">
              <CheckCircle2 className="h-6 w-6 text-(--color-emerald)" />
            </div>
            <h3 className="mt-3 font-display text-base font-semibold text-(--color-ink)">Import selesai</h3>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-(--color-emerald-soft) p-3 text-center">
                <p className="font-display text-lg font-semibold text-emerald-700">{summary.success}</p>
                <p className="text-xs text-emerald-700">Berhasil ditambahkan</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="font-display text-lg font-semibold text-amber-700">{summary.phoneWarnings}</p>
                <p className="text-xs text-amber-700">No HP duplikat</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="font-display text-lg font-semibold text-red-700">{summary.failed}</p>
                <p className="text-xs text-red-700">Gagal</p>
              </div>
            </div>

            {summary.phoneWarnings > 0 && (
              <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-amber-50 px-3 py-2.5 thin-scrollbar">
                <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> Nomor HP duplikat terdeteksi (tetap diimpor):
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-700">
                  {rowResults
                    .filter((r) => r.phoneWarning)
                    .map((r, idx) => (
                      <li key={idx}>
                        {r.row.name || "(tanpa nama)"} — {r.phoneWarning}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {summary.failed > 0 && (
              <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-red-50 px-3 py-2.5 thin-scrollbar">
                <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <AlertCircle className="h-4 w-4" /> Baris yang gagal:
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-red-700">
                  {rowResults
                    .filter((r) => !r.success)
                    .map((r, idx) => (
                      <li key={idx}>
                        {r.row.name || "(tanpa nama)"} — {r.error}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <button onClick={handleFinish} className="mt-6 w-full rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
