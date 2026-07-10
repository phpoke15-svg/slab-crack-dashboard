-- Restock board: curated SKUs + stock history (Walmart API + Pokemon Center reports).
-- Safe to re-run.

create table if not exists public.restock_products (
  id uuid primary key default gen_random_uuid(),
  retailer text not null check (retailer in ('walmart', 'pokemon_center')),
  external_id text not null,
  name text not null,
  product_url text not null,
  image_url text,
  msrp numeric(10, 2),
  category text not null default 'sealed',
  queue_likely boolean not null default false,
  active boolean not null default true,
  in_stock boolean,
  price numeric(10, 2),
  last_checked_at timestamptz,
  last_restock_at timestamptz,
  last_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer, external_id)
);

create index if not exists restock_products_active_idx
  on public.restock_products (active, retailer);

create table if not exists public.restock_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.restock_products(id) on delete cascade,
  in_stock boolean not null,
  price numeric(10, 2),
  source text not null,
  noted_at timestamptz not null default now()
);

create index if not exists restock_events_product_idx
  on public.restock_events (product_id, noted_at desc);

alter table public.restock_products enable row level security;
alter table public.restock_events enable row level security;

drop policy if exists "restock_products_public_read" on public.restock_products;
create policy "restock_products_public_read"
  on public.restock_products for select
  to anon, authenticated
  using (active = true);

drop policy if exists "restock_events_public_read" on public.restock_events;
create policy "restock_events_public_read"
  on public.restock_events for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.restock_products p
      where p.id = product_id and p.active = true
    )
  );

grant select on public.restock_products to anon, authenticated;
grant select on public.restock_events to anon, authenticated;
grant all on public.restock_products to service_role;
grant all on public.restock_events to service_role;

-- Seed placeholders — replace external_id / URLs with real SKUs you care about.
insert into public.restock_products (
  retailer, external_id, name, product_url, category, queue_likely, active
) values
  (
    'walmart',
    'REPLACE_WALMART_ITEM_ID',
    'Example: Pokémon TCG Elite Trainer Box (update SKU)',
    'https://www.walmart.com/ip/REPLACE_WALMART_ITEM_ID',
    'sealed',
    false,
    false
  ),
  (
    'pokemon_center',
    'pc-example-etb',
    'Example: Pokémon Center ETB (update URL)',
    'https://www.pokemoncenter.com/product/REPLACE',
    'sealed',
    true,
    false
  )
on conflict (retailer, external_id) do nothing;
