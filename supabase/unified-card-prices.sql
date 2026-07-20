-- Unified card pricing (run in Supabase SQL Editor after schema.sql / pokematch-setup.sql)
-- Canonical price cache + daily history for all CollecTools features.

create table if not exists public.card_prices (
  card_id text primary key,
  raw_price numeric(10, 2),
  psa7_price numeric(10, 2),
  psa8_price numeric(10, 2),
  psa9_price numeric(10, 2),
  psa10_price numeric(10, 2),
  price_source text not null default 'pricecharting',
  synced_at timestamptz not null default now(),
  sync_error text,
  card_name text,
  card_set text,
  card_number text
);

create index if not exists card_prices_synced_at_idx
  on public.card_prices (synced_at desc);

create index if not exists card_prices_raw_price_idx
  on public.card_prices (raw_price desc)
  where raw_price is not null and raw_price > 0;

create table if not exists public.price_history (
  id bigserial primary key,
  card_id text not null,
  snapshot_date date not null,
  grade smallint not null default 0 check (grade between 0 and 10),
  price numeric(10, 2) not null check (price > 0),
  sale_count integer,
  source text not null default 'snapshot',
  captured_at timestamptz not null default now(),
  unique (card_id, snapshot_date, grade)
);

create index if not exists price_history_lookup_idx
  on public.price_history (card_id, grade, snapshot_date desc);

-- Cursor for walking the full cards catalog across cron runs (price history backfill).
create table if not exists public.price_history_sync_state (
  id integer primary key check (id = 1),
  cursor_offset integer not null default 0,
  catalog_size integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.price_history_sync_state (id, cursor_offset, catalog_size)
values (1, 0, 0)
on conflict (id) do nothing;

alter table public.price_history_sync_state enable row level security;
grant all on public.price_history_sync_state to service_role;

alter table public.card_prices enable row level security;
alter table public.price_history enable row level security;

grant select on public.card_prices to anon, authenticated;
grant select on public.price_history to anon, authenticated;
grant all on public.card_prices to service_role;
grant all on public.price_history to service_role;
grant usage, select on sequence public.price_history_id_seq to service_role;

drop policy if exists "card_prices_public_read" on public.card_prices;
create policy "card_prices_public_read"
  on public.card_prices for select
  to anon, authenticated
  using (true);

drop policy if exists "price_history_public_read" on public.price_history;
create policy "price_history_public_read"
  on public.price_history for select
  to anon, authenticated
  using (true);

-- Optional: seed card_prices from existing binder cache (safe to re-run).
insert into public.card_prices (
  card_id,
  raw_price,
  price_source,
  synced_at,
  card_name,
  card_set,
  card_number
)
select
  card_id,
  raw_price,
  'binder_migrate',
  synced_at,
  card_name,
  card_set,
  card_number
from public.binder_card_prices
where raw_price > 0
on conflict (card_id) do update set
  raw_price = coalesce(excluded.raw_price, card_prices.raw_price),
  synced_at = greatest(excluded.synced_at, card_prices.synced_at),
  card_name = coalesce(nullif(excluded.card_name, ''), card_prices.card_name),
  card_set = coalesce(nullif(excluded.card_set, ''), card_prices.card_set),
  card_number = coalesce(nullif(excluded.card_number, ''), card_prices.card_number)
where card_prices.raw_price is null or card_prices.raw_price <= 0;
