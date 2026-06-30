-- =========================================================
-- SCHEMA: Event Check-in App (v2)
-- Jalankan script ini di Supabase SQL Editor untuk SETUP BARU.
-- Jika project Supabase kamu sudah berjalan dengan schema versi
-- sebelumnya (kolom company/category), gunakan sql/migration_v2.sql
-- agar data lama tidak hilang.
-- =========================================================

-- 1. Tabel utama peserta undangan
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  seat_number text not null,              -- nomor kursi, juga dipakai untuk grouping
  family_group text not null,             -- nama keluarga/rombongan, juga dipakai untuk grouping
  qty integer not null default 1 check (qty >= 1),  -- jumlah pax dalam 1 tiket/QR (kapasitas maksimal)
  code text not null unique,              -- kode unik yang di-encode ke QR
  status text not null default 'belum_hadir' check (status in ('belum_hadir', 'hadir')),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id),  -- panitia yang melakukan scan/check-in
  wa_sent_at timestamptz,                 -- terakhir kali broadcast WA terkirim ke peserta ini
  wa_status text,                         -- status terakhir pengiriman WA: sent / failed
  -- Konfirmasi kehadiran (RSVP) yang diisi peserta sendiri lewat link publik
  rsvp_status text not null default 'belum_konfirmasi' check (
    rsvp_status in ('belum_konfirmasi', 'menunggu_approval', 'dikonfirmasi_hadir', 'dikonfirmasi_tidak_hadir')
  ),
  rsvp_qty_response integer,              -- jumlah orang yang akan datang, diisi peserta (<= qty)
  rsvp_responded_at timestamptz,          -- kapan peserta mengisi form RSVP
  rsvp_reviewed_by uuid references auth.users(id),  -- panitia yang approve/tolak
  rsvp_reviewed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_status_idx on public.participants (status);
create index if not exists participants_code_idx on public.participants (code);
create index if not exists participants_family_group_idx on public.participants (family_group);
create index if not exists participants_seat_number_idx on public.participants (seat_number);
create index if not exists participants_rsvp_status_idx on public.participants (rsvp_status);

-- 2. Auto-update kolom updated_at setiap kali baris diubah
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_participants_updated_at on public.participants;
create trigger trg_participants_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

-- 3. Log riwayat broadcast WhatsApp (opsional, untuk audit trail)
create table if not exists public.broadcast_logs (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references auth.users(id),
  message text not null,
  target_filter text not null default 'all',
  total_recipients integer not null default 0,
  total_success integer not null default 0,
  total_failed integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3b. Antrian (queue) broadcast WhatsApp — header job per klik "Kirim broadcast"
create table if not exists public.broadcast_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id),
  message_template text not null,
  target_filter text not null default 'all',
  include_qr boolean not null default false,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed', 'cancelled')
  ),
  total_recipients integer not null default 0,
  total_success integer not null default 0,
  total_failed integer not null default 0,
  -- Jeda antar pesan (ms) dan ukuran batch per pemanggilan endpoint proses,
  -- disimpan per job agar mudah disesuaikan tanpa redeploy. batch_size
  -- sengaja dibuat kecil (default 3) karena setiap panggilan endpoint
  -- proses dibatasi waktu eksekusi oleh Vercel (maxDuration) — dengan jeda
  -- 3-8 detik per pesan, batch besar berisiko terpotong di tengah jalan
  -- sebelum batch tersebut selesai diproses sepenuhnya.
  delay_min_ms integer not null default 3000,
  delay_max_ms integer not null default 8000,
  batch_size integer not null default 3,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists broadcast_jobs_status_idx on public.broadcast_jobs (status);

-- 3c. Item per penerima di dalam satu job broadcast
create table if not exists public.broadcast_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.broadcast_jobs(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'failed')
  ),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists broadcast_job_items_job_id_idx on public.broadcast_job_items (job_id);
create index if not exists broadcast_job_items_status_idx on public.broadcast_job_items (job_id, status);

-- 4. Pengaturan acara: nama, alamat, dan gambar template tiket/QR
create table if not exists public.event_settings (
  id integer primary key default 1,
  event_name text not null default 'Nama Acara Anda',
  event_address text not null default '',
  ticket_background_url text,             -- URL gambar template di Supabase Storage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_settings_singleton check (id = 1)
);

insert into public.event_settings (id) values (1)
  on conflict (id) do nothing;

drop trigger if exists trg_event_settings_updated_at on public.event_settings;
create trigger trg_event_settings_updated_at
before update on public.event_settings
for each row execute function public.set_updated_at();

-- =========================================================
-- ROW LEVEL SECURITY
-- Semua akses (read & write) ke tabel ini WAJIB login.
-- Tidak ada akses publik/anonim sama sekali.
-- =========================================================

alter table public.participants enable row level security;
alter table public.broadcast_logs enable row level security;
alter table public.broadcast_jobs enable row level security;
alter table public.broadcast_job_items enable row level security;
alter table public.event_settings enable row level security;

drop policy if exists "authenticated_select_participants" on public.participants;
create policy "authenticated_select_participants"
  on public.participants for select
  to authenticated
  using (true);

drop policy if exists "authenticated_insert_participants" on public.participants;
create policy "authenticated_insert_participants"
  on public.participants for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated_update_participants" on public.participants;
create policy "authenticated_update_participants"
  on public.participants for update
  to authenticated
  using (true);

drop policy if exists "authenticated_delete_participants" on public.participants;
create policy "authenticated_delete_participants"
  on public.participants for delete
  to authenticated
  using (true);

drop policy if exists "authenticated_all_broadcast_logs" on public.broadcast_logs;
create policy "authenticated_all_broadcast_logs"
  on public.broadcast_logs for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated_all_broadcast_jobs" on public.broadcast_jobs;
create policy "authenticated_all_broadcast_jobs"
  on public.broadcast_jobs for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated_all_broadcast_job_items" on public.broadcast_job_items;
create policy "authenticated_all_broadcast_job_items"
  on public.broadcast_job_items for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated_all_event_settings" on public.event_settings;
create policy "authenticated_all_event_settings"
  on public.event_settings for all
  to authenticated
  using (true)
  with check (true);

-- =========================================================
-- AKSES PUBLIK TERBATAS UNTUK HALAMAN RSVP (/rsvp/[code])
-- Peserta mengisi konfirmasi kehadiran TANPA login. Akses publik
-- ini sengaja dibatasi: tidak bisa SELECT semua baris (hanya lewat
-- RPC function di bawah yang mewajibkan kode tiket yang valid), dan
-- tidak bisa mengubah kolom selain milik RSVP itu sendiri.
-- =========================================================

-- Function ini dipanggil dari halaman publik untuk mengambil data
-- peserta berdasarkan code, dengan kolom yang dibatasi (security definer
-- supaya tidak perlu policy SELECT publik penuh ke seluruh tabel).
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

-- Function untuk submit RSVP. Memvalidasi qty_response <= qty kapasitas,
-- dan hanya mengubah kolom-kolom RSVP (tidak bisa menyentuh status
-- kehadiran/check-in atau data lain).
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
-- AKSES TERBATAS UNTUK MENAMPILKAN "SIAPA YANG CHECK-IN" / "SIAPA YANG
-- REVIEW RSVP" DI HALAMAN LAPORAN & INPUT PESERTA
-- =========================================================

-- Tabel participants menyimpan checked_in_by/rsvp_reviewed_by/created_by
-- sebagai UUID yang merujuk ke auth.users — tabel ini TIDAK otomatis bisa
-- di-query langsung lewat client (Supabase sengaja menyembunyikan skema
-- auth dari API publik). Function ini menyediakan jalan terbatas untuk
-- panitia yang sudah login melihat EMAIL rekan panitia lain (bukan data
-- sensitif lain seperti password hash) — hanya dipakai untuk keperluan
-- menampilkan label "di-scan oleh ..." di UI, bukan untuk tujuan lain.
create or replace function public.get_panitia_emails()
returns table (id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select id, email from auth.users;
$$;

-- Sengaja HANYA untuk authenticated (bukan anon) — daftar email panitia
-- adalah informasi internal tim, bukan untuk halaman publik (RSVP) mana pun.
grant execute on function public.get_panitia_emails() to authenticated;

-- =========================================================
-- SUPABASE STORAGE: bucket untuk gambar template tiket
-- Jalankan bagian ini juga supaya upload background tiket berfungsi.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('ticket-assets', 'ticket-assets', true)
on conflict (id) do nothing;

drop policy if exists "authenticated_upload_ticket_assets" on storage.objects;
create policy "authenticated_upload_ticket_assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ticket-assets');

drop policy if exists "authenticated_update_ticket_assets" on storage.objects;
create policy "authenticated_update_ticket_assets"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ticket-assets');

drop policy if exists "authenticated_delete_ticket_assets" on storage.objects;
create policy "authenticated_delete_ticket_assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ticket-assets');

drop policy if exists "public_read_ticket_assets" on storage.objects;
create policy "public_read_ticket_assets"
  on storage.objects for select
  to public
  using (bucket_id = 'ticket-assets');

-- =========================================================
-- CATATAN PENTING:
-- Halaman SCAN QR pada aplikasi ini tetap mengharuskan login
-- (sesuai permintaan: semua input/update/delete harus login).
-- Jika nanti ingin scan QR bisa dilakukan TANPA login oleh
-- panitia di pintu masuk menggunakan device terpisah, tabel ini
-- bisa ditambah policy khusus untuk role 'anon' yang dibatasi
-- hanya boleh UPDATE kolom status berdasarkan kode unik.
-- =========================================================
