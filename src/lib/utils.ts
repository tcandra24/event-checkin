/**
 * Menormalkan nomor HP Indonesia ke format internasional tanpa simbol '+'.
 * Contoh: "08123456789" -> "628123456789"
 *         "+62 812-3456-789" -> "628123456789"
 *         "62812..."  -> "62812..."
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
  }
  // jika sudah diawali "62", biarkan apa adanya

  return digits;
}

/**
 * Format nomor HP untuk ditampilkan agar mudah dibaca, contoh:
 * "628123456789" -> "+62 812-3456-789"
 */
export function formatPhoneDisplay(raw: string): string {
  const digits = normalizePhone(raw);
  if (!digits.startsWith("62")) return raw;
  const rest = digits.slice(2);
  if (rest.length < 9) return `+${digits}`;
  const part1 = rest.slice(0, 3);
  const part2 = rest.slice(3, 7);
  const part3 = rest.slice(7);
  return `+62 ${part1}-${part2}${part3 ? "-" + part3 : ""}`;
}

/** Membuat kode unik untuk peserta, contoh: EVT-7F3K9Q */
export function generateParticipantCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa karakter ambigu (0,O,1,I)
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EVT-${result}`;
}
