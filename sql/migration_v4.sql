-- =========================================================
-- MIGRATION v3 -> v4
-- Menambahkan sistem antrian (queue) untuk broadcast WhatsApp,
-- supaya pengiriman ke banyak penerima (misal 200+) bisa dilakukan
-- dengan jeda antar-pesan yang aman dan diproses secara bertahap
-- di background — tanpa terkena timeout Server Action / serverless
-- function, dan tetap berjalan walau panitia menutup browser.
--
-- Jalankan ini jika project Supabase kamu sudah pernah menjalankan
-- schema.sql/migration sebelumnya dan sudah punya tabel participants.
-- =========================================================

-- 1. Header job — 1 row per klik "Kirim broadcast"
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
  -- Jeda antar pesan dalam milidetik, disimpan per job agar bisa
  -- disesuaikan tanpa redeploy (misal dibuat lebih lambat jika perlu).
  delay_min_ms integer not null default 3000,
  delay_max_ms integer not null default 8000,
  batch_size integer not null default 10,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists broadcast_jobs_status_idx on public.broadcast_jobs (status);

-- 2. Item per penerima — 1 row per peserta yang akan dikirimi pesan
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

-- 3. RLS — sama seperti tabel lain, wajib login
alter table public.broadcast_jobs enable row level security;
alter table public.broadcast_job_items enable row level security;

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

-- =========================================================
-- CATATAN: tabel broadcast_logs (riwayat ringkas, sudah ada sejak
-- sebelumnya) tetap dipertahankan untuk laporan ringkas; broadcast_jobs
-- & broadcast_job_items menggantikan PROSES pengirimannya saja.
-- =========================================================
