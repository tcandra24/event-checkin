-- =========================================================
-- SCHEMA: Event Check-in App
-- Jalankan script ini di Supabase SQL Editor
-- (Project Supabase > SQL Editor > New Query > paste > Run)
-- =========================================================

-- 1. Tabel utama peserta undangan
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  company text,
  category text not null default 'Umum' check (category in ('VIP', 'Umum')),
  code text not null unique,              -- kode unik yang di-encode ke QR
  status text not null default 'belum_hadir' check (status in ('belum_hadir', 'hadir')),
  checked_in_at timestamptz,
  wa_sent_at timestamptz,                 -- terakhir kali broadcast WA terkirim ke peserta ini
  wa_status text,                         -- status terakhir pengiriman WA: sent / failed
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_status_idx on public.participants (status);
create index if not exists participants_code_idx on public.participants (code);
create index if not exists participants_category_idx on public.participants (category);

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
  target_filter text not null default 'all',  -- all / vip / umum / belum_hadir
  total_recipients integer not null default 0,
  total_success integer not null default 0,
  total_failed integer not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- Semua akses (read & write) ke tabel ini WAJIB login.
-- Tidak ada akses publik/anonim sama sekali.
-- =========================================================

alter table public.participants enable row level security;
alter table public.broadcast_logs enable row level security;

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

-- =========================================================
-- CATATAN PENTING:
-- Halaman SCAN QR pada aplikasi ini tetap mengharuskan login
-- (sesuai permintaan: semua input/update/delete harus login).
-- Jika nanti ingin scan QR bisa dilakukan TANPA login oleh
-- panitia di pintu masuk menggunakan device terpisah, tabel ini
-- bisa ditambah policy khusus untuk role 'anon' yang dibatasi
-- hanya boleh UPDATE kolom status berdasarkan kode unik.
-- =========================================================
