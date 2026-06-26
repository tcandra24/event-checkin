import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import QRCode from "qrcode";
import path from "path";

export interface TicketCardInput {
  participantName: string;
  code: string;
  qty: number;
  rsvp_qty_response: number | null;
  eventName: string;
  eventAddress: string;
  backgroundUrl: string | null;
}

const CARD_WIDTH = 800;
const CARD_HEIGHT = 1420;

const SANS_FAMILY = "Ticket Sans";
const SERIF_FAMILY = "Ticket Serif";

// @napi-rs/canvas TIDAK mewarisi font sistem operasi. Di lingkungan
// serverless (Vercel dll), tidak ada font apa pun ter-install secara
// default — jika pakai nama generic "sans-serif"/"serif" tanpa registrasi
// manual, ctx.fillText() akan gagal diam-diam (teks tidak tergambar,
// padahal gambar/QR tetap normal). Solusinya: bundel font sendiri dan
// register manual lewat GlobalFonts.
let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;

  const fontsDir = path.join(process.cwd(), "src/lib/fonts");

  GlobalFonts.registerFromPath(path.join(fontsDir, "Poppins-Regular.ttf"), SANS_FAMILY);
  GlobalFonts.registerFromPath(path.join(fontsDir, "Poppins-Medium.ttf"), SANS_FAMILY);
  GlobalFonts.registerFromPath(path.join(fontsDir, "Poppins-Bold.ttf"), SANS_FAMILY);
  GlobalFonts.registerFromPath(path.join(fontsDir, "Lora-Variable.ttf"), SERIF_FAMILY);

  fontsRegistered = true;
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Membuat gambar kartu tiket lengkap: background custom (cover, gelap di tepi
 * agar teks tetap terbaca), nama acara & alamat di atas, panel QR putih di
 * tengah berisi kode + QR + nama tamu, dan info jumlah pax di bawahnya.
 * Mengembalikan buffer PNG yang siap diunduh atau dikirim lewat Fonnte.
 */
export async function generateTicketCard(input: TicketCardInput): Promise<Buffer> {
  ensureFontsRegistered();

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");

  // 1. Background
  if (input.backgroundUrl) {
    try {
      const bg = await loadImage(input.backgroundUrl);
      const scale = Math.max(CARD_WIDTH / bg.width, CARD_HEIGHT / bg.height);
      const drawW = bg.width * scale;
      const drawH = bg.height * scale;
      ctx.drawImage(bg, (CARD_WIDTH - drawW) / 2, (CARD_HEIGHT - drawH) / 2, drawW, drawH);
    } catch {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    }
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#1e293b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // 2. Overlay gelap tipis di seluruh kanvas supaya teks putih tetap kontras
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // 3. Nama acara & alamat di bagian atas
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 70px "${SANS_FAMILY}"`;
  const eventLines = wrapText(ctx, input.eventName, CARD_WIDTH - 120);
  let y = 130;
  for (const line of eventLines) {
    ctx.fillText(line, CARD_WIDTH / 2, y);
    y += 44;
  }

  if (input.eventAddress) {
    ctx.font = `400 30px "${SANS_FAMILY}"`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const addressLines = wrapText(ctx, input.eventAddress, CARD_WIDTH - 140);
    y += 8;
    for (const line of addressLines) {
      ctx.fillText(line, CARD_WIDTH / 2, y);
      y += 30;
    }
  }

  // 4. Panel putih untuk QR code, diposisikan di tengah kanvas
  const panelWidth = 560;
  const panelHeight = 700;
  const panelX = (CARD_WIDTH - panelWidth) / 2;
  const panelY = 420;
  const radius = 16;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(panelX + radius, panelY);
  ctx.arcTo(panelX + panelWidth, panelY, panelX + panelWidth, panelY + panelHeight, radius);
  ctx.arcTo(panelX + panelWidth, panelY + panelHeight, panelX, panelY + panelHeight, radius);
  ctx.arcTo(panelX, panelY + panelHeight, panelX, panelY, radius);
  ctx.arcTo(panelX, panelY, panelX + panelWidth, panelY, radius);
  ctx.closePath();
  ctx.fill();

  // 5. Kode tiket di atas QR
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 30px "${SANS_FAMILY}"`;
  ctx.fillText(input.code, CARD_WIDTH / 2, panelY + 60);

  // 6. QR code
  const qrSize = 420;
  const qrDataUrl = await QRCode.toBuffer(input.code, {
    width: qrSize,
    margin: 1,
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, CARD_WIDTH / 2 - qrSize / 2, panelY + 90, qrSize, qrSize);

  // 7. Nama peserta di bawah QR
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 30px "${SANS_FAMILY}"`;
  ctx.fillText(input.participantName, CARD_WIDTH / 2, panelY + 90 + qrSize + 50);

  // 8. Jumlah pax di bawah panel
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `400 25px "${SANS_FAMILY}"`;
  ctx.fillText("VALID FOR", CARD_WIDTH / 2, panelY + panelHeight + 60);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 23px "${SERIF_FAMILY}"`;
  ctx.fillText(`${input.rsvp_qty_response ? `${input.rsvp_qty_response} / ` : ""}${input.qty} Person${input.qty > 1 ? "s" : ""}`, CARD_WIDTH / 2, panelY + panelHeight + 100);

  // 9. Footer instruksi
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `600 30px "${SANS_FAMILY}"`;
  ctx.fillText("TUNJUKKAN QR CODE INI DI LOKASI ACARA", CARD_WIDTH / 2, CARD_HEIGHT - 60);

  return canvas.encode("png");
}
