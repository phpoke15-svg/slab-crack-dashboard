-- Pokemon-API schema migration (Phase 2)
-- Run in Supabase SQL Editor AFTER unified-card-prices.sql on existing projects.
-- Safe to re-run (IF NOT EXISTS / idempotent updates).

-- ─── 1. Legacy pc-* → poke-* backup mapping ───────────────────────────────────

create table if not exists public.card_id_legacy_map (
  legacy_pc_id text primary key,
  new_poke_id text,
  tcggo_id integer,
  tcgplayer_id integer,
  tcg_id text,
  card_name text,
  card_set text,
  card_number text,
  language text,
  resolution_status text not null default 'pending'
    check (resolution_status in ('pending', 'resolved', 'failed', 'skipped', 'manual')),
  resolution_error text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.card_id_legacy_map drop constraint if exists card_id_legacy_map_language_check;
alter table public.card_id_legacy_map
  add constraint card_id_legacy_map_language_check
  check (language is null or language in ('en', 'ja'));

create index if not exists card_id_legacy_map_new_poke_id_idx
  on public.card_id_legacy_map (new_poke_id)
  where new_poke_id is not null;

create index if not exists card_id_legacy_map_status_idx
  on public.card_id_legacy_map (resolution_status);

alter table public.card_id_legacy_map enable row level security;

grant select on public.card_id_legacy_map to authenticated;
grant all on public.card_id_legacy_map to service_role;

drop policy if exists "card_id_legacy_map_service_read" on public.card_id_legacy_map;
create policy "card_id_legacy_map_service_read"
  on public.card_id_legacy_map for select
  to authenticated
  using (true);

-- ─── 2. card_prices — pokemon-api metadata columns ───────────────────────────

alter table public.card_prices add column if not exists tcggo_id integer;
alter table public.card_prices add column if not exists tcgplayer_id integer;
alter table public.card_prices add column if not exists tcg_id text;
alter table public.card_prices add column if not exists language text default 'en';
alter table public.card_prices add column if not exists legacy_pricecharting_id text;

alter table public.card_prices drop constraint if exists card_prices_language_check;
alter table public.card_prices
  add constraint card_prices_language_check
  check (language is null or language in ('en', 'ja'));

alter table public.card_prices alter column price_source set default 'tcggo';

update public.card_prices
set legacy_pricecharting_id = replace(card_id, 'pc-', '')
where card_id like 'pc-%'
  and (legacy_pricecharting_id is null or legacy_pricecharting_id = '');

update public.card_prices
set tcg_id = replace(card_id, 'poke-', '')
where card_id like 'poke-%'
  and card_id not like 'poke-tcggo-%'
  and (tcg_id is null or tcg_id = '');

create index if not exists card_prices_tcg_id_idx
  on public.card_prices (tcg_id)
  where tcg_id is not null;

create index if not exists card_prices_legacy_pc_idx
  on public.card_prices (legacy_pricecharting_id)
  where legacy_pricecharting_id is not null;

-- ─── 3. binder_card_prices (PokeMatch portfolio cache) ───────────────────────

alter table public.binder_card_prices add column if not exists legacy_pc_id text;
alter table public.binder_card_prices add column if not exists tcg_id text;
alter table public.binder_card_prices add column if not exists language text default 'en';

alter table public.binder_card_prices drop constraint if exists binder_card_prices_language_check;
alter table public.binder_card_prices
  add constraint binder_card_prices_language_check
  check (language is null or language in ('en', 'ja'));

update public.binder_card_prices
set legacy_pc_id = replace(card_id, 'pc-', '')
where card_id like 'pc-%'
  and (legacy_pc_id is null or legacy_pc_id = '');

-- ─── 4. user_binders (PokeMatch I have / I want) ─────────────────────────────

alter table public.user_binders add column if not exists legacy_pc_id text;
alter table public.user_binders add column if not exists pokemon_api_tcg_id text;

update public.user_binders
set legacy_pc_id = replace(card_id, 'pc-', '')
where card_id like 'pc-%'
  and (legacy_pc_id is null or legacy_pc_id = '');

create index if not exists user_binders_legacy_pc_idx
  on public.user_binders (legacy_pc_id)
  where legacy_pc_id is not null;

-- ─── 5. slab_watchlist_cards (SlabCrack feed) ────────────────────────────────

alter table public.slab_watchlist_cards add column if not exists legacy_pricecharting_id text;
alter table public.slab_watchlist_cards add column if not exists pokemon_api_tcg_id text;

update public.slab_watchlist_cards
set legacy_pricecharting_id = pricecharting_id
where pricecharting_id is not null
  and (legacy_pricecharting_id is null or legacy_pricecharting_id = '');

-- ─── 6. Seed mapping table from existing pc-* references ─────────────────────

insert into public.card_id_legacy_map (legacy_pc_id, card_name, card_set, card_number, resolution_status)
select distinct
  replace(cp.card_id, 'pc-', ''),
  cp.card_name,
  cp.card_set,
  cp.card_number,
  'pending'
from public.card_prices cp
where cp.card_id like 'pc-%'
on conflict (legacy_pc_id) do nothing;

insert into public.card_id_legacy_map (legacy_pc_id, card_name, card_set, card_number, resolution_status)
select distinct
  replace(bp.card_id, 'pc-', ''),
  bp.card_name,
  bp.card_set,
  bp.card_number,
  'pending'
from public.binder_card_prices bp
where bp.card_id like 'pc-%'
on conflict (legacy_pc_id) do nothing;

insert into public.card_id_legacy_map (legacy_pc_id, card_name, card_set, card_number, resolution_status)
select distinct
  ub.legacy_pc_id,
  ub.card_name,
  ub.card_set,
  ub.card_number,
  'pending'
from public.user_binders ub
where ub.legacy_pc_id is not null
on conflict (legacy_pc_id) do nothing;

insert into public.card_id_legacy_map (legacy_pc_id, card_name, card_set, card_number, resolution_status)
select distinct
  sw.legacy_pricecharting_id,
  sc.name,
  sc.set_name,
  sc.card_number,
  'pending'
from public.slab_watchlist_cards sw
left join public.slab_cards sc on sc.id = sw.card_id
where sw.legacy_pricecharting_id is not null
on conflict (legacy_pc_id) do nothing;
