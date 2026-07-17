-- Giveaway ad rewards: free users can watch up to 3 rewarded ads/day for +10 synthetic minutes each.
-- Run in Supabase SQL Editor after supabase/giveaway.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Daily ad watch counter (one row per user per UTC day)
-- ---------------------------------------------------------------------------
create table if not exists public.user_daily_ads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  ads_watched integer not null default 0 check (ads_watched >= 0 and ads_watched <= 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists user_daily_ads_date_idx
  on public.user_daily_ads (date desc);

-- ---------------------------------------------------------------------------
-- Google SSV transaction dedupe (prevents replay of rewarded-ad callbacks)
-- ---------------------------------------------------------------------------
create table if not exists public.ad_reward_transactions (
  transaction_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists ad_reward_transactions_user_date_idx
  on public.ad_reward_transactions (user_id, reward_date desc);

-- ---------------------------------------------------------------------------
-- RLS: service role only (Next.js API routes)
-- ---------------------------------------------------------------------------
alter table public.user_daily_ads enable row level security;
alter table public.ad_reward_transactions enable row level security;

revoke all on public.user_daily_ads from anon, authenticated;
revoke all on public.ad_reward_transactions from anon, authenticated;

grant all on public.user_daily_ads to service_role;
grant all on public.ad_reward_transactions to service_role;

comment on table public.user_daily_ads is
  'Rewarded ads watched per user per UTC day (max 3). Each ad counts as 10 synthetic active minutes toward free-tier giveaway entry.';
comment on table public.ad_reward_transactions is
  'Dedupes Google AdMob / Ad Manager server-side verification (SSV) rewarded-ad callbacks.';
