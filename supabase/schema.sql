-- SlabCrack dashboard schema (Supabase SQL Editor)
-- Paste the ENTIRE file and click Run.
--
-- If you need a clean re-run, uncomment the DROP block below first.

-- drop table if exists public.slab_anomalies cascade;
-- drop table if exists public.slab_watchlist_cards cascade;
-- drop table if exists public.slab_cards cascade;

-- If upgrading an existing database, also run:
-- alter table public.slab_cards add column if not exists release_date date;

create table public.slab_cards (
  id text primary key,
  name text not null,
  set_name text not null,
  card_number text not null,
  rarity text,
  image_small text,
  image_large text,
  release_date date,
  updated_at timestamptz not null default now()
);

create table public.slab_watchlist_cards (
  id text primary key,
  card_id text references public.slab_cards(id) on delete set null,
  pricecharting_id text,
  search_query text,
  ebay_queries jsonb,
  market_insight text not null default '',
  created_at timestamptz not null default now()
);

create table public.slab_anomalies (
  watchlist_id text primary key references public.slab_watchlist_cards(id) on delete cascade,
  card_id text references public.slab_cards(id) on delete set null,
  raw_price numeric(10, 2) not null,
  slab_grade integer not null check (slab_grade between 1 and 10),
  slab_price numeric(10, 2) not null,
  deficit numeric(10, 2) not null,
  percentage_savings integer not null,
  recent_raw_sales jsonb not null default '[]'::jsonb,
  recent_slab_sales jsonb not null default '[]'::jsonb,
  grade_prices jsonb,
  sample_counts jsonb,
  synced_at timestamptz not null default now()
);

create index slab_anomalies_synced_at_idx on public.slab_anomalies (synced_at desc);
create index slab_watchlist_cards_card_id_idx on public.slab_watchlist_cards (card_id);

create table public.slab_price_snapshots (
  id bigserial primary key,
  watchlist_id text not null references public.slab_watchlist_cards(id) on delete cascade,
  grade integer not null check (grade between 7 and 10),
  raw_price numeric(10, 2) not null,
  slab_price numeric(10, 2) not null,
  deficit numeric(10, 2) not null,
  snapshot_date date not null default ((timezone('utc', now()))::date),
  captured_at timestamptz not null default now(),
  unique (watchlist_id, grade, snapshot_date)
);

create index slab_price_snapshots_lookup_idx
  on public.slab_price_snapshots (watchlist_id, grade, snapshot_date desc);

create table public.slab_sale_events (
  id bigserial primary key,
  watchlist_id text not null references public.slab_watchlist_cards(id) on delete cascade,
  grade integer not null check (grade between 0 and 10),
  sold_date date not null,
  total_price numeric(10, 2) not null,
  title text not null default '',
  url text,
  source text not null default 'ebay',
  dedupe_key text not null,
  captured_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index slab_sale_events_lookup_idx
  on public.slab_sale_events (watchlist_id, grade, sold_date desc);

alter table public.slab_cards enable row level security;
alter table public.slab_watchlist_cards enable row level security;
alter table public.slab_anomalies enable row level security;
alter table public.slab_price_snapshots enable row level security;
alter table public.slab_sale_events enable row level security;

grant select on public.slab_cards to anon, authenticated;
grant select on public.slab_watchlist_cards to anon, authenticated;
grant select on public.slab_anomalies to anon, authenticated;
grant select on public.slab_price_snapshots to anon, authenticated;
grant select on public.slab_sale_events to anon, authenticated;

grant all on public.slab_cards to service_role;
grant all on public.slab_watchlist_cards to service_role;
grant all on public.slab_anomalies to service_role;
grant all on public.slab_price_snapshots to service_role;
grant all on public.slab_sale_events to service_role;
grant usage, select on sequence public.slab_price_snapshots_id_seq to service_role;
grant usage, select on sequence public.slab_sale_events_id_seq to service_role;

drop policy if exists "slab_cards_public_read" on public.slab_cards;
create policy "slab_cards_public_read"
  on public.slab_cards for select
  to anon, authenticated
  using (true);

drop policy if exists "slab_watchlist_public_read" on public.slab_watchlist_cards;
create policy "slab_watchlist_public_read"
  on public.slab_watchlist_cards for select
  to anon, authenticated
  using (true);

drop policy if exists "slab_anomalies_public_read" on public.slab_anomalies;
create policy "slab_anomalies_public_read"
  on public.slab_anomalies for select
  to anon, authenticated
  using (true);

drop policy if exists "slab_price_snapshots_public_read" on public.slab_price_snapshots;
create policy "slab_price_snapshots_public_read"
  on public.slab_price_snapshots for select
  to anon, authenticated
  using (true);

drop policy if exists "slab_sale_events_public_read" on public.slab_sale_events;
create policy "slab_sale_events_public_read"
  on public.slab_sale_events for select
  to anon, authenticated
  using (true);
