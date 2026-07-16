-- Prize snapshot columns for monthly giveaway draws (safe to re-run).

alter table public.giveaway_draws
  add column if not exists account_snapshot integer,
  add column if not exists prize_arv_usd numeric(12, 2),
  add column if not exists prize_per_account_usd numeric(6, 4) not null default 0.10;

create table if not exists public.giveaway_prize_snapshots (
  month_period text primary key check (month_period ~ '^\d{4}-\d{2}$'),
  snapshot_at timestamptz not null,
  account_snapshot integer not null check (account_snapshot >= 0),
  prize_arv_usd numeric(12, 2) not null check (prize_arv_usd >= 0),
  prize_per_account_usd numeric(6, 4) not null default 0.10,
  captured_at timestamptz not null default now()
);

alter table public.giveaway_prize_snapshots enable row level security;
revoke all on public.giveaway_prize_snapshots from anon, authenticated;
grant all on public.giveaway_prize_snapshots to service_role;
