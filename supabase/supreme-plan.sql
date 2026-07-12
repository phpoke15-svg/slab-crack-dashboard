-- Allow Supreme plan (owner / allowlist only — never sold via Stripe).
-- Safe to re-run.

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'premium', 'pro', 'supreme'));

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'premium', 'pro', 'supreme'));
