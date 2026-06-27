# Event Check-in — Aplikasi Manajemen Peserta & QR Check-in

Aplikasi web untuk mengelola peserta undangan acara: import data peserta dari
Excel, kirim konfirmasi kehadiran (RSVP) sebelum tiket final dibagikan,
generate tiket QR code bergambar otomatis, scan QR untuk check-in di lokasi
acara, laporan kehadiran real-time, dan broadcast WhatsApp ke peserta lewat
Fonnte.

## Fitur

1. **Login panitia** (Supabase Auth) — wajib login untuk akses semua halaman
   kecuali halaman publik RSVP.
2. **Input Peserta** — tambah, ubah, hapus data peserta dengan field nama,
   nomor WhatsApp, **nomor kursi**, **keluarga/rombongan**, dan **qty**
   (jumlah pax maksimal per tiket). Setiap peserta otomatis mendapat kode
   unik dan **tiket QR bergambar**.
3. **Import dari Excel** — unduh template `.xlsx` siap pakai, isi data
   peserta secara massal, unggah kembali untuk diimpor sekaligus. Ada
   preview & validasi per baris sebelum data benar-benar disimpan.
4. **Konfirmasi Kehadiran (RSVP)** — kirim tautan RSVP ke peserta lewat
   WhatsApp. Peserta membuka tautan (tanpa perlu login), memilih **Hadir**
   (lalu mengisi jumlah orang yang akan datang, maksimal sesuai qty tiket)
   atau **Tidak Hadir**. Konfirmasi "Hadir" masuk ke status **Menunggu
   Approval** dan perlu ditinjau oleh panitia sebelum dianggap final.
5. **Pengaturan Tiket** — atur nama acara, alamat, dan unggah 1 gambar latar
   yang dipakai sebagai desain tiket untuk seluruh peserta.
6. **Laporan Kehadiran** — statistik hadir/belum hadir (dihitung per orang),
   status RSVP, pencarian, filter per keluarga/rombongan, dan ekspor CSV.
7. **Scan QR Code** — kamera HP/laptop, alat scanner QR fisik (USB/Bluetooth),
   atau input manual. Status otomatis berubah jadi "hadir". Satu QR = satu
   kali check-in untuk seluruh rombongan dalam tiket itu.
8. **Broadcast WhatsApp** — dua mode: **RSVP** (kirim tautan konfirmasi
   kehadiran) atau **Tiket QR final** (kirim gambar tiket lengkap, dipakai
   setelah RSVP disetujui). Bisa difilter per status kehadiran atau per
   keluarga/rombongan.

## Alur kerja yang disarankan

1. Import peserta dari Excel (atau input manual satu-satu).
2. Atur nama acara, alamat, dan gambar latar tiket di **Pengaturan Tiket**.
3. Broadcast WhatsApp mode **RSVP** ke seluruh peserta — mereka akan
   menerima tautan untuk konfirmasi kehadiran.
4. Peserta membuka tautan, pilih hadir (isi jumlah orang) atau tidak hadir.
5. Panitia meninjau setiap konfirmasi "Hadir" di halaman **Input Peserta**
   (ada notifikasi jumlah RSVP yang menunggu approval) dan menyetujui jumlah
   final yang hadir.
6. Setelah disetujui, broadcast WhatsApp lagi dengan mode **Tiket QR final**
   untuk mengirim tiket bergambar lengkap ke peserta yang sudah dikonfirmasi.
7. Saat hari acara, gunakan halaman **Scan QR Code** untuk check-in.

## Stack teknologi

- **Next.js 16** (App Router, Server Actions, TypeScript)
- **Tailwind CSS v4** untuk styling
- **Supabase** — database Postgres + Auth + Storage + RPC function untuk
  akses publik RSVP yang aman (cukup pakai paket gratis)
- **Fonnte** — gateway WhatsApp untuk broadcast
- `qrcode` — generate kode QR mentah
- `@napi-rs/canvas` — render gambar tiket lengkap (background + QR + teks) di
  server, tanpa perlu Chromium/Puppeteer
- `html5-qrcode` — scan QR lewat kamera browser
- `xlsx` (SheetJS) — baca/tulis file Excel untuk fitur import & template

---

## 1. Setup Supabase

### Jika ini setup BARU (belum pernah ada data)

1. Buat project baru di [supabase.com](https://supabase.com).
2. Masuk ke **SQL Editor**, buka file [`sql/schema.sql`](./sql/schema.sql),
   copy seluruh isinya, paste ke SQL Editor, lalu **Run**.

   Script ini membuat:
   - Tabel `participants` (nama, kursi, keluarga, qty, kode QR, status
     kehadiran, status RSVP)
   - Tabel `broadcast_logs` (riwayat pengiriman broadcast)
   - Tabel `event_settings` (nama acara, alamat, URL gambar latar tiket)
   - Storage bucket `ticket-assets` (untuk menyimpan gambar latar tiket)
   - Function `get_participant_for_rsvp` & `submit_rsvp` (RPC aman untuk
     halaman RSVP publik)
   - Row Level Security: seluruh akses ke tabel wajib login. Akses publik
     (anon) HANYA bisa lewat dua RPC function di atas, dan dibatasi hanya
     bisa membaca/menulis data RSVP milik 1 kode tiket yang valid.

### Jika project Supabase kamu sudah pernah menjalankan schema versi lama

- Versi lama masih punya kolom `company`/`category` →
  jalankan [`sql/migration_v2.sql`](./sql/migration_v2.sql) dulu.
- Sudah punya `seat_number`/`family_group`/`qty` tapi belum ada RSVP →
  jalankan [`sql/migration_v3.sql`](./sql/migration_v3.sql).
- Belum punya tabel `broadcast_jobs`/`broadcast_job_items` (sistem antrian
  broadcast) → jalankan [`sql/migration_v4.sql`](./sql/migration_v4.sql).
- Sudah punya `broadcast_jobs` tapi `batch_size` defaultnya masih 10 (versi
  lama, berisiko timeout di Vercel) → jalankan
  [`sql/migration_v5.sql`](./sql/migration_v5.sql) untuk menurunkannya ke 3.

Semua migrasi di atas aman dijalankan tanpa menghapus data peserta yang
sudah ada — jalankan secara berurutan sesuai versi schema kamu saat ini.

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
SUPABASE_SERVICE_ROLE_KEY=isi-dengan-service-role-key
BROADCAST_PROCESS_SECRET=isi-dengan-string-acak-panjang
FONNTE_TOKEN=isi-dengan-token-fonnte
NEXT_PUBLIC_EVENT_NAME="Event Check-in"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Penting**: `NEXT_PUBLIC_APP_URL` harus diisi dengan domain produksi yang
> benar setelah deploy (misal `https://checkin.acara-kamu.com`), karena nilai
> ini dipakai untuk membangun tautan RSVP (`{link_rsvp}`) dan untuk memicu
> proses broadcast di background (lihat bagian "Cara kerja broadcast WhatsapApp"
> di bawah). Jika salah/masih `localhost`, peserta tidak akan bisa membuka
> tautan tersebut, dan broadcast tidak akan berjalan di produksi.
>
> `SUPABASE_SERVICE_ROLE_KEY` ambil dari **Project Settings → API → service_role
> key** (klik "Reveal" karena defaultnya tersembunyi). **Jangan pernah** diberi
> prefix `NEXT_PUBLIC_` atau diekspos ke kode sisi klien — key ini punya akses
> penuh ke seluruh database tanpa terikat Row Level Security.
>
> `BROADCAST_PROCESS_SECRET` adalah string rahasia buatan sendiri (boleh apa
> saja, semakin panjang & acak semakin aman). Contoh generate cepat:
> `openssl rand -hex 32` di terminal.
>
> Nama acara, alamat, dan gambar latar tiket **tidak** diatur lewat
> environment variable — semua diatur lewat halaman **Pengaturan Tiket**
> setelah login.

## 4. Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000), login dengan akun
panitia, lalu buka **Pengaturan Tiket** untuk mengisi nama acara, alamat, dan
mengunggah gambar latar tiket sebelum mulai input/import peserta.

## 5. Deploy ke produksi

Cara termudah adalah deploy ke [Vercel](https://vercel.com):

1. Push project ini ke repository GitHub.
2. Import repository tersebut di Vercel.
3. Tambahkan environment variables yang sama seperti `.env.local` — jangan
   lupa set `NEXT_PUBLIC_APP_URL` ke domain produksi yang benar.
4. Deploy. Halaman scan QR membutuhkan koneksi **HTTPS** agar kamera browser
   bisa diakses — Vercel otomatis menyediakan HTTPS.

> Catatan teknis: pembuatan gambar tiket memakai `@napi-rs/canvas`, sebuah
> native Node addon dengan prebuilt binary untuk Linux x64 (termasuk
> lingkungan Vercel Node.js runtime), macOS, dan Windows. Pastikan deploy
> menggunakan **Node.js runtime** (bukan Edge runtime) — ini sudah default
> untuk Server Actions di Next.js.
>
> **Font pada gambar tiket di-bundle manual** (lihat `src/lib/fonts/`) dan
> diregistrasi lewat `GlobalFonts.registerFromPath()` di `src/lib/ticketCard.ts`.
> Ini disengaja: `@napi-rs/canvas` tidak mewarisi font sistem operasi, dan
> lingkungan serverless seperti Vercel tidak memiliki font apa pun
> ter-install secara default. Tanpa bundling ini, gambar QR & background
> tetap tampil normal tapi **semua teks pada tiket akan kosong/tidak
> tergambar** di produksi — meskipun terlihat normal saat development di
> komputer lokal (karena OS desktop biasanya selalu punya font fallback).
> Jangan hapus folder `src/lib/fonts/` atau baris `outputFileTracingIncludes`
> di `next.config.ts`, karena keduanya saling terkait untuk memastikan font
> ikut ter-bundle ke serverless function saat deploy.

## Struktur halaman

| Route          | Login? | Keterangan                                                  |
| -------------- | ------ | ----------------------------------------------------------- |
| `/login`       | -      | Halaman login panitia                                       |
| `/peserta`     | Wajib  | Input/import peserta, review RSVP, kirim broadcast WhatsApp |
| `/laporan`     | Wajib  | Statistik & tabel kehadiran + status RSVP, ekspor CSV       |
| `/scan`        | Wajib  | Scan QR code (kamera/alat scanner/manual) untuk check-in    |
| `/pengaturan`  | Wajib  | Atur nama acara, alamat, dan gambar latar tiket             |
| `/rsvp/[code]` | Publik | Halaman bagi peserta mengonfirmasi kehadiran, tanpa login   |

## Field data peserta

| Field               | Keterangan                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `name`              | Nama tamu/peserta                                                                              |
| `phone`             | Nomor WhatsApp (otomatis dirapikan ke format `62...`)                                          |
| `seat_number`       | Nomor kursi — teks bebas, juga dipakai untuk pencarian/grouping                                |
| `family_group`      | Nama keluarga/rombongan — teks bebas, dipakai untuk filter & broadcast                         |
| `qty`               | Jumlah pax maksimal yang berlaku untuk 1 QR code                                               |
| `code`              | Kode unik yang di-encode ke dalam QR, contoh `EVT-7F3K9Q2A`                                    |
| `status`            | Status kehadiran fisik: `belum_hadir` atau `hadir`                                             |
| `rsvp_status`       | `belum_konfirmasi`, `menunggu_approval`, `dikonfirmasi_hadir`, atau `dikonfirmasi_tidak_hadir` |
| `rsvp_qty_response` | Jumlah orang yang dikonfirmasi peserta akan datang (≤ `qty`)                                   |

## Import peserta dari Excel

1. Buka halaman **Input Peserta**, klik **Import Excel**.
2. Klik **Unduh template** untuk mendapatkan file `.xlsx` dengan kolom yang
   sudah benar: `Nama`, `No HP`, `Nomor Kursi`, `Keluarga`, `Qty`.
3. Isi data di Excel (boleh pakai aplikasi spreadsheet apa saja), simpan.
4. Kembali ke aplikasi, unggah file tersebut.
5. Aplikasi menampilkan **preview** seluruh baris beserta status validasinya
   (baris yang datanya tidak lengkap akan ditandai dan otomatis dilewati).
6. Klik **Import** untuk menyimpan seluruh baris yang valid. Setiap baris
   otomatis mendapat kode unik dan tiket QR seperti input manual.

> Kolom `Qty` boleh dikosongkan — defaultnya akan dianggap 1. Nama kolom
> bersifat fleksibel (mendukung beberapa variasi penulisan seperti "No. HP"
> atau "Pax"), tapi paling aman tetap memakai template yang disediakan.

## Konfirmasi Kehadiran (RSVP)

### Mengirim tautan RSVP ke peserta

1. Buka halaman **Input Peserta**, klik **Broadcast WA**.
2. Pilih jenis broadcast **RSVP (link konfirmasi)**.
3. Pilih target penerima, sesuaikan isi pesan jika perlu (placeholder
   `{link_rsvp}` akan otomatis diganti dengan tautan unik tiap peserta).
4. Kirim. Setiap peserta menerima tautan `https://domainmu.com/rsvp/KODE_TIKET`.

### Yang dilihat & dilakukan peserta

Peserta membuka tautan tanpa perlu login atau install apa pun, melihat nama
mereka dan kapasitas maksimal tiket, lalu memilih:

- **Ya, saya akan hadir** → diminta mengisi jumlah orang yang datang
  (1 sampai maksimal qty tiket), lalu submit.
- **Tidak dapat hadir** → langsung tercatat sebagai tidak hadir.

Jika peserta sudah pernah mengisi RSVP sebelumnya, tautan yang sama akan
menampilkan status terakhir mereka (bukan form kosong lagi), agar tidak ada
isi ulang yang membingungkan.

### Meninjau (approve) RSVP

Konfirmasi "Hadir" dari peserta **tidak otomatis final** — masuk ke status
**Menunggu Approval**. Di halaman **Input Peserta**:

- Ada banner notifikasi jumlah RSVP yang menunggu peninjauan.
- Setiap baris dengan status "Menunggu approval" bisa diklik untuk membuka
  modal review, di mana panitia bisa melihat jumlah yang diminta peserta dan
  menyesuaikan jumlah final sebelum menyetujui (atau menolak).
- Setelah disetujui, status berubah menjadi "RSVP: Hadir" dan jumlah final
  tersimpan di `rsvp_qty_response`.

Setelah seluruh/sebagian RSVP disetujui, panitia bisa mengirim broadcast
mode **Tiket QR final** ke peserta yang sudah dikonfirmasi (filter "Sudah
hadir" tidak relevan di sini — gunakan filter per keluarga/rombongan atau
kirim ke semua lalu cek manual, sesuai kebutuhan acara).

## Cara kerja QR code & tiket bergambar

- Setiap peserta mendapat `code` unik saat dibuat (manual atau via import).
- QR code yang digenerate berisi teks `code` tersebut secara langsung.
- Tiket yang dilihat/diunduh/dikirim ke peserta adalah **kartu lengkap**
  yang dirender di server: gambar latar dari Pengaturan Tiket + nama acara +
  alamat + kode tiket + QR + nama peserta + jumlah pax.
- Saat di-scan di halaman `/scan`, status berubah menjadi `hadir` beserta
  timestamp check-in. **Satu QR = satu kali check-in** untuk seluruh
  rombongan dalam tiket itu, terlepas dari nilai `qty`.
- Scan ulang pada QR yang sama menampilkan "Sudah check-in sebelumnya" tanpa
  mengubah data, sehingga aman dari double-scan.

## Mode pemindaian di halaman Scan

- **Kamera** — memakai kamera HP/laptop langsung dari browser.
- **Alat Scanner / Manual** — untuk alat scanner QR fisik (USB/Bluetooth,
  bekerja seperti keyboard) atau input manual jika QR rusak/tidak terbaca.
  Kolom input selalu auto-focus sehingga panitia tidak perlu klik ulang
  antar peserta.

## Mengirim broadcast WhatsApp

Tersedia dua mode (toggle di bagian atas modal broadcast):

- **RSVP (link konfirmasi)** — mengirim tautan agar peserta mengonfirmasi
  kehadiran. Placeholder tambahan `{link_rsvp}` tersedia di mode ini.
- **Tiket QR final** — mengirim gambar tiket bergambar lengkap, dipakai
  setelah RSVP disetujui atau untuk acara yang tidak memakai RSVP sama sekali.

Placeholder pesan yang didukung di kedua mode: `{nama}`, `{kursi}`,
`{keluarga}`, `{qty}`, `{kode}`. Target penerima bisa difilter berdasarkan
status kehadiran atau per keluarga/rombongan (daftar keluarga otomatis
muncul sesuai data yang sudah diinput).

### Cara kerja broadcast WhatsApp di balik layar

Untuk menghindari nomor WhatsApp terkena deteksi spam/banned saat mengirim ke
banyak penerima (puluhan hingga ratusan), broadcast **tidak** dikirim sekaligus
dalam satu proses. Saat tombol "Kirim broadcast" diklik:

1. Sebuah **job** dibuat (tabel `broadcast_jobs`) beserta daftar seluruh
   penerima sebagai **item antrian** (tabel `broadcast_job_items`), semuanya
   berstatus `pending`. Langkah ini instan.
2. Endpoint `/api/broadcast/process` dipicu untuk memproses **satu batch
   kecil** (default 3 penerima) dari job tersebut — setiap pesan dikirim
   satu per satu dengan **jeda acak 3–8 detik** (bukan jeda tetap, supaya
   pola pengiriman terlihat manusiawi, bukan seperti bot).
3. Setelah satu batch selesai, endpoint itu otomatis memicu dirinya sendiri
   lagi untuk batch berikutnya (self-chaining) — berulang sampai seluruh
   item dalam job berstatus `sent` atau `failed`.
4. UI menampilkan progres secara real-time lewat polling setiap beberapa
   detik, dan **tetap berjalan di background walau halaman ditutup**, karena
   prosesnya berjalan di server (endpoint API), bukan di browser.

Untuk 200 penerima dengan jeda rata-rata ~5 detik, perkiraan waktu total
sekitar 15–20 menit — ini wajar dan disengaja demi keamanan nomor WhatsApp,
bukan bug performa.

Parameter jeda (`delay_min_ms`, `delay_max_ms`) dan ukuran batch
(`batch_size`) tersimpan per job di tabel `broadcast_jobs` dan bisa
disesuaikan langsung lewat SQL Editor Supabase jika perlu, tanpa perlu
mengubah kode atau redeploy.

> **Catatan teknis penting (batas waktu eksekusi di Vercel)**: setiap
> pemanggilan `/api/broadcast/process` dibatasi waktu eksekusi maksimal 60
> detik (`maxDuration`) oleh Vercel. `batch_size` default sengaja dibuat
> kecil (3, bukan angka besar) karena dengan jeda 3–8 detik per pesan
> ditambah waktu request ke Fonnte (dan generate gambar tiket jika mode
> QR), satu batch besar bisa melebihi 60 detik dan **terpotong paksa di
> tengah jalan** — menyebabkan item yang sedang diproses tertinggal di
> status `pending` tanpa pernah diperbarui (gejalanya: broadcast terlihat
> "tersangkut"). Jika ingin menaikkan `batch_size`, pastikan estimasi total
> waktunya (`batch_size × rata-rata delay + overhead`) tetap jauh di bawah
> 60 detik.
>
> Pemicu batch berikutnya (self-chaining) juga dibungkus
> [`waitUntil()`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil)
> dari paket `@vercel/functions`, bukan sekadar `fetch()` tanpa `await`.
> Tanpa ini, Vercel bisa langsung membekukan/menghentikan eksekusi
> serverless function segera setelah response dikirim ke caller — termasuk
> memutus request lanjutan yang baru saja ditembak tapi belum sempat
> benar-benar terkirim. `waitUntil()` memberi tahu Vercel untuk menunda
> penghentian function sampai promise tersebut benar-benar tuntas.

> **Keandalan pengaman (Vercel Cron Job)**: meski sudah memakai `waitUntil()`
> di atas, mekanisme self-chaining tetap bisa gagal pada kondisi langka
> (misal gangguan jaringan sesaat), membuat job macet di status
> `processing` dengan sisa item `pending` yang tidak lanjut terproses.
> Sebagai pengaman tambahan, project ini menyertakan **Vercel Cron Job**
> (`vercel.json` + endpoint `/api/broadcast/cron`) yang memeriksa job aktif
> tanpa aktivitas pengiriman dan memicu ulang `/api/broadcast/process`
> untuk job tersebut. Lihat bagian [Setup Vercel Cron Job](#setup-vercel-cron-job)
> di bawah — perhatikan juga batasan frekuensi cron sesuai plan Vercel kamu.

> Mode Tiket QR final butuh waktu sedikit lebih lama per pesan dibanding mode
> RSVP, karena setiap gambar tiket di-render ulang saat broadcast berjalan.

## Monitoring & debugging broadcast WhatsApp

Ada dua lapis informasi yang bisa kamu cek kalau ada pesan yang gagal
terkirim atau prosesnya terasa aneh:

### 1. Detail error langsung di UI

Di modal **Kirim Broadcast WhatsApp**, begitu ada pesan yang gagal, kotak
merah akan menampilkan **nama peserta beserta alasan gagalnya** (bukan
cuma daftar nama) — informasi ini diambil langsung dari respons asli Fonnte
untuk pesan tersebut (misal nomor tidak valid, device terputus, kuota
habis, dsb), dan tetap terlihat selagi broadcast masih berjalan, tidak
perlu menunggu seluruh proses selesai.

Detail ini juga tersimpan permanen di kolom `error_message` pada tabel
`broadcast_job_items`, dan kolom `wa_status` pada tabel `participants`
(format: `failed: <alasan>`) — bisa dicek langsung lewat Supabase Table
Editor/SQL Editor kapan saja, misalnya:

```sql
select p.name, p.phone, bji.error_message, bji.sent_at
from broadcast_job_items bji
join participants p on p.id = bji.participant_id
where bji.job_id = '<id-job-yang-ingin-dicek>'
  and bji.status = 'failed';
```

### 2. Log mentah server (paling detail) di Vercel

Untuk melihat **seluruh** proses pengiriman secara verbose — termasuk
response mentah dari Fonnte untuk setiap pesan, berapa lama jeda yang
dipakai, kapan setiap batch dimulai/selesai, dan kapan job dianggap
selesai — buka **Vercel Dashboard → Project kamu → Logs** (atau tab
**Runtime Logs**), lalu filter/cari kata kunci `[broadcast]`.

Setiap baris log mengikuti format yang mudah ditelusuri, contoh:

```
[broadcast] Job 3f9a... status saat ini: processing (total 5 penerima)
[broadcast] Job 3f9a...: memproses batch berisi 3 item...
[broadcast] -> Budi Santoso [EVT-7F3K9Q2A] (628123456789): mengirim pesan teks...
[broadcast] -> Budi Santoso [EVT-7F3K9Q2A] (628123456789): HTTP 200, response Fonnte: {"status":true,...}
[broadcast] -> Budi Santoso [EVT-7F3K9Q2A] (628123456789): berhasil terkirim.
[broadcast] Menunggu 5230ms sebelum pesan berikutnya...
[broadcast] -> Siti Aminah [EVT-XYZ12345] (628129876543): mengirim pesan teks...
[broadcast] -> Siti Aminah [EVT-XYZ12345] (628129876543): GAGAL — Nomor tidak terdaftar di WhatsApp
```

Log ini berguna untuk kasus yang tidak tertangkap di kolom `error_message`
biasa, misalnya:

- Endpoint `/api/broadcast/process` ditolak (`secret tidak cocok`) — tanda
  `BROADCAST_PROCESS_SECRET` salah/tidak konsisten antar environment.
- Self-chaining ke batch berikutnya tidak terpicu — cek apakah ada baris
  log "memicu batch berikutnya" yang muncul tapi tidak diikuti baris log
  batch baru dalam waktu wajar (indikasi `waitUntil()` gagal, jaringan
  bermasalah, atau function dihentikan paksa).
- Error generate gambar tiket (`Gagal generate tiket untuk ...`) — biasanya
  terkait gambar latar yang rusak/tidak bisa diunduh dari Storage.

## Setup Vercel Cron Job

Fitur ini berjalan otomatis setelah deploy ke Vercel, **tidak perlu setup
manual tambahan di dashboard Vercel** — konfigurasinya sudah ada di
`vercel.json` pada root project:

```json
{
  "crons": [
    {
      "path": "/api/broadcast/cron",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Yang perlu dipastikan:

1. **Tambahkan environment variable `CRON_SECRET`** di Vercel (Project
   Settings → Environment Variables) — isi dengan string acak (boleh
   generate lewat `openssl rand -hex 32`). Vercel otomatis mengirim nilai
   ini sebagai header `Authorization: Bearer <CRON_SECRET>` setiap kali
   memanggil endpoint cron, dan endpoint akan menolak permintaan yang
   header-nya tidak cocok.
2. **Pastikan `BROADCAST_PROCESS_SECRET` dan `SUPABASE_SERVICE_ROLE_KEY`**
   juga sudah diisi (lihat bagian Konfigurasi Environment di atas) — cron
   job memerlukan keduanya untuk memicu ulang proses broadcast.
3. Cron Job di Vercel **hanya aktif di plan Pro** ke atas untuk frekuensi
   di bawah harian; di plan Hobby/gratis, cron tetap bisa dipakai tapi
   dengan frekuensi minimum 1x per hari. Jika kamu memakai plan gratis,
   sesuaikan `schedule` di `vercel.json` (misal `"0 0 * * *"` untuk sekali
   sehari), atau pertimbangkan upgrade plan jika volume broadcast cukup
   besar dan sering, supaya job macet bisa terdeteksi lebih cepat.
4. Verifikasi cron berjalan: buka **Vercel Dashboard → Project kamu → Cron
   Jobs** setelah deploy, di sana akan terlihat riwayat eksekusi dan
   responsnya setiap kali endpoint dipanggil.

## Catatan keamanan

- Semua halaman dashboard (`/peserta`, `/laporan`, `/scan`, `/pengaturan`)
  **wajib login**, ditegakkan lewat Next.js Middleware dan Supabase Row
  Level Security.
- Halaman `/rsvp/[code]` sengaja dibuat publik (tanpa login) agar peserta
  bisa mengisi konfirmasi langsung dari WhatsApp. Akses ini dibatasi ketat
  lewat 2 RPC function (`get_participant_for_rsvp`, `submit_rsvp`):
  - Peserta hanya bisa melihat/mengubah data miliknya sendiri, dan hanya
    jika mereka tahu kode tiket yang valid (acak, 8 karakter, sulit ditebak).
  - Peserta hanya bisa mengubah kolom-kolom RSVP — tidak bisa menyentuh
    status check-in, qty kapasitas, atau data peserta lain mana pun.
  - Tidak ada query yang mengizinkan publik melihat daftar seluruh peserta.
- Gambar latar tiket disimpan di Supabase Storage bucket `ticket-assets`
  dengan akses baca publik (diperlukan agar gambar bisa dimuat saat membuat
  tiket dan saat dikirim ke Fonnte), tapi hanya panitia yang login yang bisa
  mengunggah/mengubah/menghapusnya.
- Endpoint `/api/broadcast/process` dan `/api/broadcast/cron` sengaja
  dikecualikan dari wajib-login di Middleware karena dipanggil server-ke-server
  (bukan dari sesi browser pengguna), tapi masing-masing tetap diamankan
  lewat secret sendiri-sendiri di dalam route handler-nya:
  - `/api/broadcast/process` memeriksa `BROADCAST_PROCESS_SECRET` yang
    dikirim di body request.
  - `/api/broadcast/cron` memeriksa header `Authorization: Bearer
<CRON_SECRET>` yang otomatis dikirim Vercel setiap kali cron berjalan.
  - Permintaan tanpa secret yang cocok akan ditolak dengan HTTP 401. Jaga
    kerahasiaan kedua nilai ini seperti password, dan **gunakan nilai yang
    berbeda** untuk masing-masing — jangan dipakai sama, supaya kebocoran
    salah satu secret tidak otomatis membuka jalur yang lain.
- Endpoint-endpoint tersebut memakai `SUPABASE_SERVICE_ROLE_KEY` (bukan anon
  key) karena tidak ada sesi login untuk diandalkan RLS biasa. Key ini
  memiliki akses penuh ke seluruh database tanpa terikat Row Level Security
  apa pun — jangan pernah expose ke kode sisi klien atau commit ke repository.
