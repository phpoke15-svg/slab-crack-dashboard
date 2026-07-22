-- Native FCM device tokens for CollecTools app queue-live alerts.
-- Run in Supabase SQL editor. Service role only (no public RLS policies).

create table if not exists public.fcm_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_token text not null,
  platform text,
  topic text not null default 'pokemon_center_alerts',
  last_subscribed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_token)
);

create index if not exists fcm_device_tokens_user_idx
  on public.fcm_device_tokens (user_id, updated_at desc);

create index if not exists fcm_device_tokens_topic_idx
  on public.fcm_device_tokens (topic, updated_at desc);

alter table public.fcm_device_tokens enable row level security;
