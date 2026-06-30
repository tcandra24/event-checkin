-- =========================================================
-- MIGRATION v5 -> v6
-- Menambahkan kolom checked_in_by pada tabel participants (mencatat
-- panitia mana yang melakukan scan/check-in), beserta RPC function
-- get_panitia_emails() untuk menampilkan email panitia tersebut di UI
-- (Laporan & Input Peserta), tanpa perlu expose tabel auth.users secara
-- langsung ke client.
--
-- Jalankan ini jika project Supabase kamu sudah pernah menjalankan
-- schema.sql versi sebelumnya. Migrasi ini aman dijalankan tanpa
-- menghapus data peserta yang sudah ada — peserta yang sudah check-in
-- SEBELUM migrasi ini akan punya checked_in_by = NULL (tidak diketahui
-- siapa yang check-in, karena datanya memang belum pernah dicatat),
-- sedangkan check-in BARU setelah migrasi akan tercatat dengan benar.
-- =========================================================

-- 1. Tambah kolom checked_in_by
alter table public.participants
  add column if not exists checked_in_by uuid references auth.users(id);

-- 2. RPC function untuk menampilkan email panitia di UI (terbatas,
--    hanya untuk authenticated, bukan untuk halaman publik RSVP).
create or replace function public.get_panitia_emails()
returns table (id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select id, email from auth.users;
$$;

grant execute on function public.get_panitia_emails() to authenticated;

-- =========================================================
-- Selesai. Setelah migrasi ini, struktur tabel participants kamu
-- akan sama dengan hasil sql/schema.sql versi terbaru (v6).
-- =========================================================
