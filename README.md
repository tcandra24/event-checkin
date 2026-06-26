# Event Check-in — Aplikasi Manajemen Peserta & QR Check-in

Aplikasi web untuk mengelola peserta undangan acara: input data peserta, generate
tiket QR code bergambar otomatis sebagai identitas, scan QR untuk check-in di
lokasi acara, laporan kehadiran real-time, dan broadcast WhatsApp ke peserta
lewat Fonnte.

## Fitur

1. **Login panitia** (Supabase Auth) — wajib login untuk akses semua halaman.
2. **Input Peserta** — tambah, ubah, hapus data peserta dengan field:
   - Nama & nomor WhatsApp
   - **Nomor kursi** dan **Keluarga/rombongan** (dipakai untuk grouping &
     filter di laporan maupun broadcast)
   - **Qty** — jumlah pax dalam 1 tiket/QR (bisa lebih dari 1 orang per QR)
   
   Setiap peserta otomatis mendapat kode unik dan **tiket QR bergambar**
   (background custom + nama acara + alamat + nama tamu + jumlah pax).
3. **Pengaturan Tiket** — atur nama acara, alamat, dan unggah 1 gambar latar
   yang akan dipakai sebagai desain tiket untuk seluruh peserta (mirip
   undangan fisik bertema).
4. **Laporan Kehadiran** — statistik hadir/belum hadir (dihitung per orang,
   bukan cuma per tiket), pencarian, filter per keluarga/rombongan, dan
   ekspor ke CSV.
5. **Scan QR Code** — gunakan kamera HP/laptop, alat scanner QR fisik
   (USB/Bluetooth), atau ketik kode secara manual. Status otomatis berubah
   dari "belum hadir" menjadi "hadir". Jika qty > 1, panitia akan diberi tahu
   bahwa tiket tersebut berlaku untuk beberapa orang sekaligus.
6. **Broadcast WhatsApp** — kirim pesan ke seluruh/sebagian peserta (filter
   per status kehadiran atau per keluarga/rombongan) lewat Fonnte, termasuk
   melampirkan gambar tiket QR bergambar milik tiap peserta.

## Stack teknologi

- **Next.js 16** (App Router, Server Actions, TypeScript)
- **Tailwind CSS v4** untuk styling
- **Supabase** — database Postgres + Auth + Storage (cukup pakai paket gratis)
- **Fonnte** — gateway WhatsApp untuk broadcast
- `qrcode` — generate kode QR mentah
- `@napi-rs/canvas` — render gambar tiket lengkap (background + QR + teks) di
  server, tanpa perlu Chromium/Puppeteer
- `html5-qrcode` — scan QR lewat kamera browser

---

## 1. Setup Supabase

### Jika ini setup BARU (belum pernah ada data)

1. Buat project baru di [supabase.com](https://supabase.com).
2. Masuk ke **SQL Editor**, buka file [`sql/schema.sql`](./sql/schema.sql),
   copy seluruh isinya, paste ke SQL Editor, lalu **Run**.

   Script ini membuat:
   - Tabel `participants` (nama, kursi, keluarga, qty, kode QR, status)
   - Tabel `broadcast_logs` (riwayat pengiriman broadcast)
   - Tabel `event_settings` (nama acara, alamat, URL gambar latar tiket)
   - Storage bucket `ticket-assets` (untuk menyimpan gambar latar tiket)
   - Row Level Security: seluruh akses wajib login, tidak ada akses
     publik/anonim ke data peserta.

### Jika project Supabase kamu SUDAH PERNAH menjalankan schema versi lama
(yang masih punya kolom `company`/`category`)

Jalankan [`sql/migration_v2.sql`](./sql/migration_v2.sql) di SQL Editor —
ini akan mengubah struktur tabel tanpa menghapus data peserta yang sudah ada.
Kolom `company`/`category` lama akan otomatis dipindahkan isinya ke kolom
`family_group` baru sebagai titik awal, lalu kamu bisa sesuaikan manual lewat
halaman Input Peserta.

### Kredensial & akun

3. Ambil kredensial API di **Project Settings → API**:
   - `Project URL` → jadi `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → jadi `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Buat akun panitia (untuk login) di **Authentication → Users → Add user**.

> Catatan: Email confirmation bisa dimatikan di **Authentication → Providers →
> Email** jika ingin akun panitia langsung aktif tanpa verifikasi email.

## 2. Setup Fonnte (broadcast WhatsApp)

1. Daftar/masuk ke [fonnte.com](https://fonnte.com) dan hubungkan nomor WhatsApp
   yang akan dipakai mengirim broadcast (scan QR seperti WhatsApp Web).
2. Salin **Token API** dari dashboard Fonnte → jadi `FONNTE_TOKEN`.
3. Pastikan device dalam status **Connected** sebelum mengirim broadcast.

## 3. Konfigurasi environment

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=isi-dengan-anon-public-key
FONNTE_TOKEN=isi-dengan-token-fonnte
NEXT_PUBLIC_EVENT_NAME="Event Check-in"
```

> Nama acara, alamat, dan gambar latar tiket **tidak** diatur lewat
> environment variable — semua diatur lewat halaman **Pengaturan Tiket** di
> dalam aplikasi setelah login, supaya bisa diubah kapan saja tanpa redeploy.

## 4. Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000), login dengan akun
panitia, lalu buka **Pengaturan Tiket** untuk mengisi nama acara, alamat, dan
mengunggah gambar latar tiket sebelum mulai input peserta.

## 5. Deploy ke produksi

Cara termudah adalah deploy ke [Vercel](https://vercel.com):

1. Push project ini ke repository GitHub.
2. Import repository tersebut di Vercel.
3. Tambahkan environment variables yang sama seperti `.env.local`.
4. Deploy. Halaman scan QR membutuhkan koneksi **HTTPS** agar kamera browser
   bisa diakses — Vercel otomatis menyediakan HTTPS.

> Catatan teknis: pembuatan gambar tiket memakai `@napi-rs/canvas`, sebuah
> native Node addon dengan prebuilt binary untuk Linux x64 (termasuk
> lingkungan Vercel Node.js runtime), macOS, dan Windows. Pastikan deploy
> menggunakan **Node.js runtime** (bukan Edge runtime) — ini sudah default
> untuk Server Actions di Next.js.

## Struktur halaman

| Route          | Keterangan                                                   |
|----------------|---------------------------------------------------------------|
| `/login`       | Halaman login panitia                                        |
| `/peserta`     | Input, ubah, hapus peserta + kirim broadcast WhatsApp         |
| `/laporan`     | Statistik & tabel kehadiran (per orang & per tiket), ekspor CSV |
| `/scan`        | Scan QR code (kamera/alat scanner/manual) untuk check-in      |
| `/pengaturan`  | Atur nama acara, alamat, dan gambar latar tiket                |

## Field data peserta

| Field           | Keterangan                                                          |
|-----------------|------------------------------------------------------------------------|
| `name`          | Nama tamu/peserta                                                    |
| `phone`         | Nomor WhatsApp (otomatis dirapikan ke format `62...`)                 |
| `seat_number`   | Nomor kursi — teks bebas, juga dipakai untuk pencarian/grouping       |
| `family_group`  | Nama keluarga/rombongan — teks bebas, dipakai untuk filter & broadcast per kelompok |
| `qty`           | Jumlah pax yang berlaku untuk 1 QR code (boleh lebih dari 1)          |
| `code`          | Kode unik yang di-encode ke dalam QR, contoh `EVT-7F3K9Q2A`           |
| `status`        | `belum_hadir` atau `hadir`                                            |

## Cara kerja QR code & tiket bergambar

- Setiap peserta mendapat `code` unik saat dibuat.
- QR code yang digenerate berisi teks `code` tersebut secara langsung.
- Tiket yang dilihat/diunduh/dikirim ke peserta bukan sekadar gambar QR
  polos, melainkan **kartu lengkap** yang dirender di server, terdiri dari:
  - Gambar latar yang diunggah di halaman Pengaturan Tiket
  - Nama acara & alamat (dari Pengaturan Tiket)
  - Kode tiket + QR code
  - Nama peserta
  - Jumlah pax ("Valid for N person(s)")
- Saat di-scan di halaman `/scan`, aplikasi mencari peserta dengan `code`
  yang sama dan mengubah status menjadi `hadir` beserta timestamp check-in.
  **Satu QR = satu kali check-in**, terlepas dari berapa nilai `qty`-nya —
  artinya 1 scan untuk 1 tiket akan menandai seluruh rombongan dalam tiket
  itu sebagai hadir sekaligus. Halaman scan akan menampilkan info jumlah pax
  agar panitia tahu berapa orang yang seharusnya masuk bersamaan.
- Scan ulang pada QR yang sama akan menampilkan pesan "Sudah check-in
  sebelumnya" tanpa mengubah data, sehingga aman dari double-scan.

## Mode pemindaian di halaman Scan

Halaman `/scan` punya dua mode yang bisa dipilih lewat tombol toggle:

- **Kamera** — memakai kamera HP/laptop langsung dari browser.
- **Alat Scanner / Manual** — untuk panitia yang memakai alat scanner QR
  fisik (USB/Bluetooth, yang bekerja seperti keyboard) atau ingin mengetik
  kode secara manual jika QR rusak/tidak terbaca. Kolom input selalu
  auto-focus sehingga panitia tidak perlu klik ulang antar peserta.

## Mengatur tampilan tiket (Pengaturan Tiket)

1. Buka halaman **Pengaturan Tiket** di sidebar.
2. Isi **nama acara** dan **alamat/lokasi** — keduanya akan tercetak di
   bagian atas setiap tiket.
3. Unggah **1 gambar latar** (disarankan rasio potret, mendekati 800×1420px,
   bertema sesuai acara — misalnya foto venue, ilustrasi, atau desain
   undangan). Gambar ini dipakai sebagai background untuk seluruh tiket
   peserta secara otomatis.
4. Simpan. Tiket baru yang dibuka/diunduh/dikirim sesudahnya akan langsung
   memakai pengaturan terbaru.

## Mengirim broadcast WhatsApp

1. Buka halaman **Input Peserta**, klik **Broadcast WA**.
2. Pilih target penerima: semua peserta, hanya yang belum/sudah hadir, atau
   per keluarga/rombongan tertentu (daftar keluarga otomatis muncul sesuai
   data yang sudah diinput).
3. Tulis pesan. Placeholder yang didukung:
   - `{nama}` — nama peserta
   - `{kursi}` — nomor kursi
   - `{keluarga}` — nama keluarga/rombongan
   - `{qty}` — jumlah pax dalam tiket tersebut
   - `{kode}` — kode unik peserta
4. Centang "Lampirkan gambar tiket QR" jika ingin setiap peserta menerima
   tiket bergambar lengkap (bukan QR polos) langsung lewat WhatsApp.
5. Klik **Kirim broadcast**. Status pengiriman per peserta tersimpan di
   kolom `wa_status`, ringkasan tersimpan di tabel `broadcast_logs`.

> Fonnte memiliki rate limit; aplikasi ini mengirim pesan secara berurutan
> dengan jeda singkat antar pesan untuk menghindari penolakan oleh Fonnte.
> Karena setiap tiket bergambar di-render ulang saat broadcast, proses ini
> butuh waktu sedikit lebih lama untuk jumlah peserta yang besar — biarkan
> halaman tetap terbuka sampai proses selesai.

## Catatan keamanan

- Semua halaman (`/peserta`, `/laporan`, `/scan`, `/pengaturan`) **wajib
  login**, ditegakkan lewat Next.js Middleware dan Supabase Row Level
  Security di level database.
- Tidak ada endpoint publik/anonim yang bisa mengubah data peserta.
- Gambar latar tiket disimpan di Supabase Storage bucket `ticket-assets`
  dengan akses baca publik (diperlukan agar gambar bisa dimuat saat membuat
  tiket dan saat dikirim ke Fonnte), tapi hanya panitia yang login yang bisa
  mengunggah/mengubah/menghapusnya.
