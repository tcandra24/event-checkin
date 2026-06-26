-- =========================================================
-- MIGRATION v2 -> v3
-- Jalankan ini jika project Supabase kamu sudah pernah menjalankan
-- schema.sql versi v2 (yang sudah punya seat_number/family_group/qty)
-- dan ingin menambahkan fitur Konfirmasi Kehadiran (RSVP) TANPA
-- menghapus data peserta yang sudah ada.
--
-- Jika ini SETUP BARU, langsung jalankan sql/schema.sql saja, TIDAK
-- perlu menjalankan file ini.
-- =========================================================

-- 1. Tambah kolom RSVP ke tabel participants
alter table public.participants
  add column if not exists rsvp_status text not null default 'belum_konfirmasi',
  add column if not exists rsvp_qty_response integer,
  add column if not exists rsvp_responded_at timestamptz,
  add column if not exists rsvp_reviewed_by uuid references auth.users(id),
  add column if not exists rsvp_reviewed_at timestamptz;

alter table public.participants
  drop constraint if exists participants_rsvp_status_check;
alter table public.participants
  add constraint participants_rsvp_status_check check (
    rsvp_status in ('belum_konfirmasi', 'menunggu_approval', 'dikonfirmasi_hadir', 'dikonfirmasi_tidak_hadir')
  );

create index if not exists participants_rsvp_status_idx on public.participants (rsvp_status);

-- 2. Function untuk halaman publik RSVP mengambil data peserta by code
create or replace function public.get_participant_for_rsvp(p_code text)
returns table (
  id uuid,
  name text,
  qty integer,
  family_group text,
  rsvp_status text,
  rsvp_qty_response integer
)
language sql
security definer
set search_path = public
as $$
  select id, name, qty, family_group, rsvp_status, rsvp_qty_response
  from public.participants
  where code = p_code
  limit 1;
$$;

grant execute on function public.get_participant_for_rsvp(text) to anon, authenticated;

-- 3. Function untuk submit RSVP dari halaman publik
create or replace function public.submit_rsvp(
  p_code text,
  p_attending boolean,
  p_qty_response integer
)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_qty integer;
  v_id uuid;
begin
  select id, qty into v_id, v_max_qty
  from public.participants
  where code = p_code
  limit 1;

  if v_id is null then
    return query select false, 'Kode tiket tidak ditemukan.';
    return;
  end if;

  if p_attending and (p_qty_response is null or p_qty_response < 1 or p_qty_response > v_max_qty) then
    return query select false, format('Jumlah orang yang hadir harus antara 1 dan %s.', v_max_qty);
    return;
  end if;

  update public.participants
  set
    rsvp_status = case when p_attending then 'menunggu_approval' else 'dikonfirmasi_tidak_hadir' end,
    rsvp_qty_response = case when p_attending then p_qty_response else 0 end,
    rsvp_responded_at = now()
  where id = v_id;

  return query select true, 'Konfirmasi berhasil disimpan.';
end;
$$;

grant execute on function public.submit_rsvp(text, boolean, integer) to anon, authenticated;

-- =========================================================
-- Selesai. Setelah migrasi ini, struktur tabel participants kamu
-- akan sama dengan hasil sql/schema.sql versi terbaru (v3).
-- =========================================================
