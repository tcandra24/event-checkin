-- =========================================================
-- MIGRATION v1 -> v2
-- Jalankan ini HANYA jika project Supabase kamu sudah pernah
-- menjalankan schema.sql versi sebelumnya (yang punya kolom
-- company & category) dan sudah ada data peserta yang ingin
-- dipertahankan.
--
-- Jika ini SETUP BARU (belum pernah ada data), langsung jalankan
-- sql/schema.sql saja, TIDAK perlu menjalankan file ini.
-- =========================================================

-- 1. Tambah kolom baru, isi default dulu dari kolom lama supaya tidak kosong
alter table public.participants
  add column if not exists seat_number text,
  add column if not exists family_group text,
  add column if not exists qty integer not null default 1;

-- 2. Migrasi data lama ke kolom baru (sesuaikan jika perlu)
update public.participants
set
  seat_number = coalesce(seat_number, '-'),
  family_group = coalesce(family_group, company, category, 'Umum')
where seat_number is null or family_group is null;

-- 3. Jadikan kolom baru wajib (not null) setelah terisi semua
alter table public.participants
  alter column seat_number set not null,
  alter column family_group set not null;

-- 4. Hapus kolom lama yang sudah tidak dipakai
alter table public.participants
  drop column if exists company,
  drop column if exists category;

-- 5. Index untuk kolom baru
create index if not exists participants_family_group_idx on public.participants (family_group);
create index if not exists participants_seat_number_idx on public.participants (seat_number);
drop index if exists participants_category_idx;

-- 6. Tabel pengaturan acara (nama, alamat, gambar template tiket)
create table if not exists public.event_settings (
  id integer primary key default 1,
  event_name text not null default 'Nama Acara Anda',
  event_address text not null default '',
  ticket_background_url text,
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

alter table public.event_settings enable row level security;

drop policy if exists "authenticated_all_event_settings" on public.event_settings;
create policy "authenticated_all_event_settings"
  on public.event_settings for all
  to authenticated
  using (true)
  with check (true);

-- 7. Storage bucket untuk gambar template tiket
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
-- Selesai. Setelah migrasi ini, struktur tabel participants kamu
-- akan sama dengan hasil sql/schema.sql versi terbaru.
-- =========================================================
