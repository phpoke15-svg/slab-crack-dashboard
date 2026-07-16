-- Daily running total of registered accounts for monthly giveaway prize ARV.
-- The snapshot on the last calendar day of each month is the official prize value.
-- Safe to re-run.

create table if not exists public.giveaway_daily_account_snapshots (
  snapshot_date date primary key,
  month_period text not null check (month_period ~ '^\d{4}-\d{2}$'),
  account_total integer not null check (account_total >= 0),
  prize_arv_usd numeric(12, 2) not null check (prize_arv_usd >= 0),
  prize_per_account_usd numeric(6, 4) not null default 0.10,
  captured_at timestamptz not null default now()
);

create index if not exists giveaway_daily_account_snapshots_month_idx
  on public.giveaway_daily_account_snapshots (month_period, snapshot_date desc);

alter table public.giveaway_daily_account_snapshots enable row level security;
revoke all on public.giveaway_daily_account_snapshots from anon, authenticated;
grant all on public.giveaway_daily_account_snapshots to service_role;
