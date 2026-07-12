-- CollecTools billing: Premium (ad-free) and Pro (ad-free + Queue Watch).
-- Safe to re-run. Run in Supabase SQL Editor after pokematch-setup.sql.

alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'premium', 'pro', 'supreme'));

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists plan_updated_at timestamptz;

create unique index if not exists profiles_stripe_customer_id_uidx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  stripe_product_id text,
  status text not null default 'inactive',
  plan text not null default 'free'
    check (plan in ('free', 'premium', 'pro', 'supreme')),
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view own subscriptions" on public.subscriptions;
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

-- Writes only via service role (Stripe webhook).
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

-- Keep profiles.plan readable with existing profile policies.
