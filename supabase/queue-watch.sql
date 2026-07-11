-- Queue Watch cross-instance reports (required on Vercel — memory alone does not work).
-- Run in Supabase SQL editor, then re-copy the bookmarklet from /queue-watch.

create table if not exists public.queue_watch_reports (
  session_id text primary key,
  live boolean not null default false,
  confidence integer not null default 0,
  signals jsonb not null default '[]'::jsonb,
  page_url text,
  reported_at timestamptz not null default now(),
  user_id uuid
);

alter table public.queue_watch_reports
  add column if not exists user_id uuid;

create index if not exists queue_watch_reports_user_reported_idx
  on public.queue_watch_reports (user_id, reported_at desc);

alter table public.queue_watch_reports enable row level security;

-- Service role writes via API; no public policies required.
