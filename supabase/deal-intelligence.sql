-- Deal Intelligence: real sample counts + daily deficit history.
-- Run in Supabase SQL Editor once.

alter table public.slab_anomalies
  add column if not exists sample_counts jsonb;

create table if not exists public.slab_price_snapshots (
  id bigserial primary key,
  watchlist_id text not null references public.slab_watchlist_cards(id) on delete cascade,
  grade integer not null check (grade between 7 and 10),
  raw_price numeric(10, 2) not null,
  slab_price numeric(10, 2) not null,
  -- raw − slab (positive = arbitrage gap)
  deficit numeric(10, 2) not null,
  snapshot_date date not null default ((timezone('utc', now()))::date),
  captured_at timestamptz not null default now(),
  unique (watchlist_id, grade, snapshot_date)
);

create index if not exists slab_price_snapshots_lookup_idx
  on public.slab_price_snapshots (watchlist_id, grade, snapshot_date desc);

alter table public.slab_price_snapshots enable row level security;

grant select on public.slab_price_snapshots to anon, authenticated;
grant all on public.slab_price_snapshots to service_role;
grant usage, select on sequence public.slab_price_snapshots_id_seq to service_role;

drop policy if exists "slab_price_snapshots_public_read" on public.slab_price_snapshots;
create policy "slab_price_snapshots_public_read"
  on public.slab_price_snapshots for select
  to anon, authenticated
  using (true);
