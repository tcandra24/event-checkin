-- =========================================================
-- MIGRATION v6 -> v7
-- Menambahkan index pada kolom phone untuk mempercepat query
-- pengecekan duplikasi nomor HP (BUKAN unique constraint — duplikasi
-- nomor HP tetap diizinkan secara sengaja, misal orang tua mendaftarkan
-- diri dan anak balita dengan nomor yang sama, tapi UI akan memberi
-- peringatan saat terdeteksi).
-- =========================================================

create index if not exists participants_phone_idx on public.participants (phone);