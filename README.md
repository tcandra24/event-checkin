# Event Check-in — Aplikasi Manajemen Peserta & QR Check-in

Aplikasi web untuk mengelola peserta undangan acara: input data peserta, generate
QR code otomatis sebagai identitas, scan QR untuk check-in di lokasi acara, laporan
kehadiran real-time, dan broadcast WhatsApp ke peserta lewat Fonnte.

## Fitur

1. **Login panitia** (Supabase Auth) — wajib login untuk akses semua halaman.
2. **Input Peserta** — tambah, ubah, hapus data peserta. Setiap peserta otomatis
   mendapat kode unik dan QR code yang bisa diunduh/dikirim.
3. **Laporan Kehadiran** — statistik hadir/belum hadir, pencarian, filter, dan
   ekspor ke CSV.
4. **Scan QR Code** — gunakan kamera HP/laptop, atau alat scanner QR fisik
   (USB/Bluetooth) yang bekerja seperti keyboard, atau ketik kode secara
   manual. Status otomatis berubah dari "belum hadir" menjadi "hadir".
5. **Broadcast WhatsApp** — kirim pesan ke seluruh/sebagian peserta (bisa difilter
   per kategori atau status kehadiran) lewat Fonnte, termasuk melampirkan gambar
   QR code pribadi tiap peserta.

## Stack teknologi

- **Next.js 16** (App Router, Server Actions, TypeScript)
- **Tailwind CSS v4** untuk styling
- **Supabase** — database Postgres + Auth (cukup pakai paket gratis)
- **Fonnte** — gateway WhatsApp untuk broadcast
- `qrcode` — generate QR code di sisi server/klien
- `html5-qrcode` — scan QR lewat kamera browser

---

## 1. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Masuk ke **SQL Editor**, buka file [`sql/schema.sql`](./sql/schema.sql) di
   project ini, copy seluruh isinya, paste ke SQL Editor, lalu **Run**.
   Script ini akan membuat:
   - Tabel `participants` (data peserta, kode QR, status kehadiran)
   - Tabel `broadcast_logs` (riwayat pengiriman broadcast)
   - Row Level Security: seluruh akses wajib login (`authenticated`), tidak ada
     akses publik/anonim sama sekali.
3. Ambil kredensial API di **Project Settings → API**:
   - `Project URL` → jadi `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → jadi `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Buat akun panitia (untuk login) di **Authentication → Users → Add user**.
   Isi email & password manual. Tidak perlu alur sign-up publik karena hanya
   panitia internal yang memakai aplikasi ini.

> Catatan: Email confirmation bisa dimatikan di **Authentication → Providers →
> Email** jika ingin akun panitia langsung aktif tanpa verifikasi email.

## 2. Setup Fonnte (broadcast WhatsApp)

1. Daftar/masuk ke [fonnte.com](https://fonnte.com) dan hubungkan nomor WhatsApp
   yang akan dipakai mengirim broadcast (scan QR seperti WhatsApp Web).
2. Salin **Token API** dari dashboard Fonnte → jadi `FONNTE_TOKEN`.
3. Pastikan device dalam status **Connected** sebelum mengirim broadcast.

Format nomor yang dikirim ke Fonnte sudah otomatis dirapikan oleh aplikasi ini
(contoh input `08123456789` otomatis menjadi `628123456789`).

## 3. Konfigurasi environment

Salin `.env.local.example` menjadi `.env.local`, lalu isi sesuai kredensial kamu:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=isi-dengan-anon-public-key
FONNTE_TOKEN=isi-dengan-token-fonnte
NEXT_PUBLIC_EVENT_NAME="Nama Acara Anda"
NEXT_PUBLIC_EVENT_DATE="Sabtu, 1 Agustus 2026"
NEXT_PUBLIC_EVENT_LOCATION="Grand Ballroom Hotel ABC, Surabaya"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) — kamu akan diarahkan ke
halaman login. Masuk dengan akun panitia yang sudah dibuat di langkah Supabase.

## 5. Deploy ke produksi

Cara termudah adalah deploy ke [Vercel](https://vercel.com) (gratis untuk
skala kecil-menengah):

1. Push project ini ke repository GitHub.
2. Import repository tersebut di Vercel.
3. Tambahkan environment variables yang sama seperti `.env.local` di
   **Project Settings → Environment Variables**.
4. Deploy. Halaman scan QR membutuhkan koneksi **HTTPS** agar kamera browser
   bisa diakses — Vercel otomatis menyediakan HTTPS.

## Struktur halaman

| Route       | Keterangan                                              |
|-------------|-----------------------------------------------------------|
| `/login`    | Halaman login panitia                                    |
| `/peserta`  | Input, ubah, hapus peserta + kirim broadcast WhatsApp     |
| `/laporan`  | Statistik & tabel kehadiran, ekspor CSV                   |
| `/scan`     | Scan QR code lewat kamera untuk check-in                  |

## Cara kerja QR code

- Setiap peserta mendapat `code` unik (contoh: `EVT-7F3K9Q2A`) saat dibuat.
- QR code yang digenerate berisi teks `code` tersebut secara langsung.
- Saat di-scan di halaman `/scan`, aplikasi mencari peserta dengan `code` yang
  sama dan mengubah status menjadi `hadir` beserta timestamp check-in.
- Scan ulang pada QR yang sama akan menampilkan pesan "Sudah check-in
  sebelumnya" tanpa mengubah data, sehingga aman dari double-scan.

## Mode pemindaian di halaman Scan

Halaman `/scan` punya dua mode yang bisa dipilih lewat tombol toggle di
bagian atas:

- **Kamera** — memakai kamera HP/laptop langsung dari browser.
- **Alat Scanner / Manual** — untuk panitia yang memakai alat scanner QR
  fisik (USB atau Bluetooth). Alat seperti ini umumnya bekerja seperti
  keyboard: setelah membaca QR, ia "mengetik" hasilnya ke kolom yang sedang
  fokus lalu otomatis menekan Enter. Mode ini menyediakan kolom input yang
  selalu siap menerima ketikan tersebut, dan otomatis kembali fokus setelah
  setiap scan sehingga panitia tidak perlu klik ulang antar peserta. Kolom
  yang sama juga bisa diisi manual lewat keyboard biasa jika QR tidak
  terbaca atau rusak.

## Catatan keamanan

- Semua halaman (`/peserta`, `/laporan`, `/scan`) **wajib login**, ditegakkan
  lewat Next.js Middleware dan Supabase Row Level Security di level database.
- Tidak ada endpoint publik/anonim yang bisa mengubah data peserta.
- Jika nanti kamu ingin panitia di pintu masuk bisa scan QR **tanpa login**
  lewat device terpisah, perlu policy RLS tambahan khusus untuk role `anon`
  yang dibatasi hanya boleh meng-update kolom `status` berdasarkan `code` —
  beri tahu saya jika ingin dibuatkan.

## Mengirim broadcast WhatsApp

1. Buka halaman **Input Peserta**, klik **Broadcast WA**.
2. Pilih target penerima (semua peserta, hanya yang belum hadir, kategori VIP,
   dll).
3. Tulis pesan. Placeholder yang didukung:
   - `{nama}` — nama peserta
   - `{instansi}` — nama instansi/perusahaan
   - `{kategori}` — VIP / Umum
   - `{kode}` — kode unik peserta
4. Centang "Lampirkan gambar QR code" jika ingin setiap peserta menerima QR
   code pribadinya langsung lewat WhatsApp.
5. Klik **Kirim broadcast**. Status pengiriman per peserta tersimpan di kolom
   `wa_status` pada tabel `participants`, dan ringkasan tersimpan di tabel
   `broadcast_logs`.

> Fonnte memiliki rate limit; aplikasi ini mengirim pesan secara berurutan
> dengan jeda singkat antar pesan untuk menghindari penolakan oleh Fonnte.
