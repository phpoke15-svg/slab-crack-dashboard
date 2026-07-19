-- Buyout Radar: daily market snapshots for stealth Z-score detection.
-- Run after buyout-radar.sql. Safe to re-run.

create table if not exists public.buyout_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  card_id text not null references public.buyout_cards(id) on delete cascade,
  scanned_at timestamptz not null,
  daily_volume integer not null default 0 check (daily_volume >= 0),
  unique_listings integer check (unique_listings is null or unique_listings >= 0),
  market_price numeric(12, 2) not null default 0 check (market_price >= 0),
  listings_source text not null default 'unknown',
  created_at timestamptz not null default now()
);

create index if not exists buyout_snapshots_card_time_idx
  on public.buyout_market_snapshots (card_id, scanned_at desc);

create unique index if not exists buyout_snapshots_card_day_uidx
  on public.buyout_market_snapshots (card_id, ((scanned_at at time zone 'utc')::date));

-- Extend anomalies log for stealth detector metrics
alter table public.buyout_anomalies_log
  add column if not exists alert_kind text not null default 'volume'
    check (alert_kind in ('volume', 'stealth', 'both'));

alter table public.buyout_anomalies_log
  add column if not exists volume_z_score numeric(10, 4);

alter table public.buyout_anomalies_log
  add column if not exists listings_z_score numeric(10, 4);

alter table public.buyout_anomalies_log
  add column if not exists unique_listings integer;

alter table public.buyout_anomalies_log
  add column if not exists price_pct_change_2p numeric(10, 4);
