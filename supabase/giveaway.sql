-- Monthly giveaway: active-time entries, AMOE mail-in, 28/month cap.
-- Run in Supabase SQL Editor after profiles/billing exist.
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Daily app activity (minutes toward today's entry)
-- ---------------------------------------------------------------------------
create table if not exists public.giveaway_daily_app_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_date date not null,
  active_minutes integer not null default 0 check (active_minutes >= 0),
  entry_awarded boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create index if not exists giveaway_daily_activity_month_idx
  on public.giveaway_daily_app_activity (user_id, activity_date desc);

-- ---------------------------------------------------------------------------
-- Individual lottery entries (one row = one ticket in the monthly drawing)
-- ---------------------------------------------------------------------------
create table if not exists public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  month_period text not null check (month_period ~ '^\d{4}-\d{2}$'),
  earned_on date not null default ((timezone('utc', now()))::date),
  source text not null check (source in ('app_usage', 'mail_in')),
  created_at timestamptz not null default now()
);

create index if not exists giveaway_entries_month_user_idx
  on public.giveaway_entries (month_period, user_id);

create index if not exists giveaway_entries_month_idx
  on public.giveaway_entries (month_period, created_at desc);

-- At most one app-usage entry per user per calendar day.
create unique index if not exists giveaway_entries_one_app_per_day_idx
  on public.giveaway_entries (user_id, earned_on)
  where source = 'app_usage';

-- ---------------------------------------------------------------------------
-- AMOE postcard log (max 4 processed postcards per user per month)
-- ---------------------------------------------------------------------------
create table if not exists public.giveaway_mail_in_postcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  month_period text not null check (month_period ~ '^\d{4}-\d{2}$'),
  entries_awarded integer not null check (entries_awarded between 1 and 7),
  processed_at timestamptz not null default now(),
  processed_by uuid references public.profiles (id) on delete set null,
  notes text not null default ''
);

create index if not exists giveaway_mail_in_month_user_idx
  on public.giveaway_mail_in_postcards (month_period, user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.giveaway_is_premium(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.plan in ('premium', 'pro', 'supreme')
      from public.profiles p
      where p.id = p_user_id
    ),
    false
  );
$$;

create or replace function public.giveaway_month_entry_count(p_user_id uuid, p_month text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.giveaway_entries e
  where e.user_id = p_user_id
    and e.month_period = p_month;
$$;

create or replace function public.giveaway_mail_in_postcard_count(p_user_id uuid, p_month text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.giveaway_mail_in_postcards m
  where m.user_id = p_user_id
    and m.month_period = p_month;
$$;

-- ---------------------------------------------------------------------------
-- RLS: service role only (Next.js / admin scripts)
-- ---------------------------------------------------------------------------
alter table public.giveaway_daily_app_activity enable row level security;
alter table public.giveaway_entries enable row level security;
alter table public.giveaway_mail_in_postcards enable row level security;

revoke all on public.giveaway_daily_app_activity from anon, authenticated;
revoke all on public.giveaway_entries from anon, authenticated;
revoke all on public.giveaway_mail_in_postcards from anon, authenticated;

grant all on public.giveaway_daily_app_activity to service_role;
grant all on public.giveaway_entries to service_role;
grant all on public.giveaway_mail_in_postcards to service_role;

comment on table public.giveaway_entries is
  'One row per giveaway lottery entry. Monthly cap 28; app usage max 1/day.';
