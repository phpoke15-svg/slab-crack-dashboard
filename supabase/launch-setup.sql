-- CollecTools one-shot schema (PokeWatch + Web Push)
-- Paste into Supabase → SQL Editor → Run
-- Project: jecuvylwpquahpqrjdqp

-- PokeWatch cross-instance reports
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

-- Web Push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid,
  queue_live boolean not null default true,
  walmart_wednesday boolean not null default true,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_queue_live_idx
  on public.push_subscriptions (queue_live)
  where queue_live = true;

create index if not exists push_subscriptions_walmart_wed_idx
  on public.push_subscriptions (walmart_wednesday)
  where walmart_wednesday = true;

create table if not exists public.push_alert_dedupe (
  alert_key text primary key,
  sent_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_alert_dedupe enable row level security;
