-- Catalog search optimization (run after cards-catalog.sql + scrydex-multi-tcg.sql)
-- Adds FTS/trigram indexes, optional denormalized prices, and Pokédex number for disambiguation.

create extension if not exists pg_trgm;

-- ─── Extend public.cards (additive — safe to re-run) ─────────────────────────

alter table public.cards
  add column if not exists game text not null default 'pokemon',
  add column if not exists scrydex_id text,
  add column if not exists pokedex_number integer,
  add column if not exists clean_name text,
  add column if not exists current_price_raw numeric(12,2),
  add column if not exists current_price_psa10 numeric(12,2),
  add column if not exists price_updated_at timestamptz;

create index if not exists cards_game_set_number_idx
  on public.cards (game, set_id, number);

create index if not exists cards_set_pokedex_idx
  on public.cards (set_id, pokedex_number)
  where pokedex_number is not null;

create index if not exists cards_scrydex_id_idx
  on public.cards (scrydex_id)
  where scrydex_id is not null;

-- Full-text search vector (name + set + number)
alter table public.cards
  add column if not exists fts_vector tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' ||
      coalesce(set_name, '') || ' ' ||
      coalesce(number, '') || ' ' ||
      coalesce(set_id, '')
    )
  ) stored;

create index if not exists cards_fts_idx
  on public.cards using gin (fts_vector);

-- Backfill clean_name + scrydex_id from poke-* ids
update public.cards
set
  clean_name = lower(regexp_replace(name, '\s+\([^)]+\)$', '', 'g')),
  scrydex_id = case
    when id like 'poke-%' then substring(id from 6)
    else scrydex_id
  end
where clean_name is null or (id like 'poke-%' and scrydex_id is null);

-- Sync denormalized prices from Scrydex cache (run periodically or after price sync)
-- Joins via poke-* → pokemon-* catalog_id; scrydex_id on cards is optional enrichment only.
create or replace function public.sync_cards_denormalized_prices()
returns integer language plpgsql as $$
declare
  updated_count integer;
begin
  with latest as (
    select distinct on (c.id)
      c.id,
      r.market_price as raw_price,
      g.market_price as psa10_price,
      greatest(
        coalesce(r.synced_at, 'epoch'::timestamptz),
        coalesce(g.synced_at, 'epoch'::timestamptz)
      ) as synced_at
    from public.cards c
    inner join public.catalog_cards cc
      on cc.catalog_id = replace(c.id, 'poke-', 'pokemon-')
    left join public.prices_raw r
      on r.catalog_id = cc.catalog_id
      and r.variant = 'normal'
      and r.condition = 'NM'
    left join public.prices_graded g
      on g.catalog_id = cc.catalog_id
      and g.company = 'PSA'
      and g.grade = '10'
      and g.variant = 'normal'
    where r.market_price is not null or g.market_price is not null
    order by c.id, cc.catalog_id
  )
  update public.cards c
  set
    current_price_raw = l.raw_price,
    current_price_psa10 = l.psa10_price,
    price_updated_at = nullif(l.synced_at, 'epoch'::timestamptz)
  from latest l
  where c.id = l.id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.sync_cards_denormalized_prices() to service_role;

-- Bridge: read Scrydex daily history through legacy card id
create or replace function public.get_scrydex_history_for_card(p_card_id text, p_days integer default 90)
returns table (
  snapshot_date date,
  raw_price numeric,
  psa10_price numeric
) language sql stable as $$
  select
    h.snapshot_date,
    max(case when h.price_type = 'raw' and h.variant = 'normal' and h.condition = 'NM' then h.market_price end) as raw_price,
    max(case when h.price_type = 'graded' and h.company = 'PSA' and h.grade = '10' then h.market_price end) as psa10_price
  from public.price_history_daily h
  inner join public.catalog_cards cc on cc.catalog_id = h.catalog_id
  where (
      cc.catalog_id = replace(p_card_id, 'poke-', 'pokemon-')
      or cc.scrydex_id = replace(replace(p_card_id, 'poke-', ''), 'pokemon-', '')
    )
    and h.snapshot_date >= current_date - (p_days || ' days')::interval
  group by h.snapshot_date
  order by h.snapshot_date asc;
$$;

grant execute on function public.get_scrydex_history_for_card(text, integer) to service_role;
