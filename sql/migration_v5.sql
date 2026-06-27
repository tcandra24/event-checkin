-- =========================================================
-- MIGRATION v4 -> v5
-- Menurunkan default batch_size dari 10 menjadi 3 pada tabel
-- broadcast_jobs.
--
-- LATAR BELAKANG: setiap pemanggilan /api/broadcast/process dibatasi
-- waktu eksekusi oleh Vercel (maxDuration). Dengan jeda 3-8 detik per
-- pesan (rata-rata ~5.5 detik), batch_size=10 membuat satu batch butuh
-- ~55 detik HANYA untuk jeda — ditambah waktu request ke Fonnte dan
-- generate gambar tiket (jika mode QR), total bisa melebihi limit waktu
-- yang diizinkan Vercel, terutama pada plan Hobby. Akibatnya proses
-- broadcast bisa "tersangkut" karena terpotong di tengah batch sebelum
-- statusnya sempat diperbarui.
--
-- Migrasi ini HANYA mengubah DEFAULT untuk job baru yang dibuat setelah
-- migrasi dijalankan — tidak mengubah job yang sudah ada/sedang berjalan.
-- =========================================================

alter table public.broadcast_jobs
  alter column batch_size set default 3;

-- Opsional: jika ada job yang masih berstatus queued/processing dengan
-- batch_size lama (10) dan ingin ikut diturunkan supaya batch berikutnya
-- juga lebih kecil, jalankan baris ini (aman, tidak memengaruhi item yang
-- sudah terkirim):
--
-- update public.broadcast_jobs
-- set batch_size = 3
-- where status in ('queued', 'processing') and batch_size > 3;
