-- Daily sales history: persist eBay sold comps for charting.
-- Run in Supabase SQL Editor once (safe to re-run).

create table if not exists public.slab_sale_events (
  id bigserial primary key,
  watchlist_id text not null references public.slab_watchlist_cards(id) on delete cascade,
  -- 0 = raw/NM; 7–10 = PSA slab grade
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

create index if not exists slab_sale_events_lookup_idx
  on public.slab_sale_events (watchlist_id, grade, sold_date desc);

alter table public.slab_sale_events enable row level security;

grant select on public.slab_sale_events to anon, authenticated;
grant all on public.slab_sale_events to service_role;
grant usage, select on sequence public.slab_sale_events_id_seq to service_role;

drop policy if exists "slab_sale_events_public_read" on public.slab_sale_events;
create policy "slab_sale_events_public_read"
  on public.slab_sale_events for select
  to anon, authenticated
  using (true);
