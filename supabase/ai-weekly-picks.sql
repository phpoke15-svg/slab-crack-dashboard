-- AI Weekly Purchase Opportunities (run in Supabase SQL Editor)
-- Stores Monday-generated picks from /api/cron/generate-weekly-picks

create extension if not exists pgcrypto;

create table if not exists public.ai_weekly_picks (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  scrydex_id text not null,
  grade_type text not null check (grade_type in ('RAW', 'PSA_9', 'PSA_10')),
  pick_price numeric(12, 2) not null check (pick_price > 0),
  ai_rationale text not null,
  confidence_score numeric(5, 2) not null check (confidence_score >= 0 and confidence_score <= 100),
  created_at timestamptz not null default now(),
  unique (week_start_date, scrydex_id, grade_type)
);

create index if not exists ai_weekly_picks_week_idx
  on public.ai_weekly_picks (week_start_date desc);

create index if not exists ai_weekly_picks_scrydex_idx
  on public.ai_weekly_picks (scrydex_id);

alter table public.ai_weekly_picks enable row level security;

grant select on public.ai_weekly_picks to anon, authenticated;
grant all on public.ai_weekly_picks to service_role;

drop policy if exists "ai_weekly_picks_public_read" on public.ai_weekly_picks;
create policy "ai_weekly_picks_public_read"
  on public.ai_weekly_picks for select
  to anon, authenticated
  using (true);
