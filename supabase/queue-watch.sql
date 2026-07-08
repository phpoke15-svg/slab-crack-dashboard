-- Optional: run in Supabase SQL editor for cross-instance Queue Watch reports.
create table if not exists public.queue_watch_reports (
  session_id text primary key,
  live boolean not null default false,
  confidence integer not null default 0,
  signals jsonb not null default '[]'::jsonb,
  page_url text,
  reported_at timestamptz not null default now()
);

alter table public.queue_watch_reports enable row level security;

-- Service role writes via API; no public policies required.
