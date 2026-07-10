-- Web Push subscriptions for phone alerts (Queue Watch live + Walmart Wednesday).
-- Run in Supabase SQL editor. Service role only (no public RLS policies).

create table if not exists push_subscriptions (
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
  on push_subscriptions (queue_live)
  where queue_live = true;

create index if not exists push_subscriptions_walmart_wed_idx
  on push_subscriptions (walmart_wednesday)
  where walmart_wednesday = true;

create table if not exists push_alert_dedupe (
  alert_key text primary key,
  sent_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
alter table push_alert_dedupe enable row level security;
