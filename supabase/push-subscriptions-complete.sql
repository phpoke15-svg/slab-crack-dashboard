-- Complete push_subscriptions schema for CollecTools Web Push.
-- Safe to re-run in Supabase SQL Editor (service role / dashboard).

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

alter table public.push_subscriptions
  add column if not exists social_alerts boolean not null default true;

alter table public.push_subscriptions
  add column if not exists price_alerts boolean not null default true;

alter table public.push_subscriptions
  add column if not exists giveaway_reminders boolean not null default false;

create index if not exists push_subscriptions_queue_live_idx
  on public.push_subscriptions (queue_live)
  where queue_live = true;

create index if not exists push_subscriptions_walmart_wed_idx
  on public.push_subscriptions (walmart_wednesday)
  where walmart_wednesday = true;

create index if not exists push_subscriptions_social_idx
  on public.push_subscriptions (social_alerts)
  where social_alerts = true;

create index if not exists push_subscriptions_price_idx
  on public.push_subscriptions (price_alerts)
  where price_alerts = true;

create index if not exists push_subscriptions_giveaway_reminders_idx
  on public.push_subscriptions (giveaway_reminders)
  where giveaway_reminders = true;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id)
  where user_id is not null;

create table if not exists public.push_alert_dedupe (
  alert_key text primary key,
  sent_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_alert_dedupe enable row level security;

grant all on public.push_subscriptions to service_role;
grant all on public.push_alert_dedupe to service_role;
