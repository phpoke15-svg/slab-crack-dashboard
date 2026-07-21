-- Scrydex batch RPC helpers (run after scrydex-multi-tcg.sql)

create or replace function public.get_cards_with_prices_batch(ids text[])
returns table (
  catalog_id text,
  game public.tcg_game,
  scrydex_id text,
  name text,
  set_name text,
  number text,
  image_small_url text,
  raw_market numeric,
  psa10_market numeric,
  psa9_market numeric,
  price_synced_at timestamptz
) language sql stable as $$
  select
    c.catalog_id,
    c.game,
    c.scrydex_id,
    c.name,
    c.set_name,
    c.number,
    c.image_small_url,
    r.market_price as raw_market,
    g10.market_price as psa10_market,
    g9.market_price as psa9_market,
    greatest(
      coalesce(r.synced_at, 'epoch'::timestamptz),
      coalesce(g10.synced_at, 'epoch'::timestamptz),
      coalesce(g9.synced_at, 'epoch'::timestamptz)
    ) as price_synced_at
  from public.catalog_cards c
  left join public.prices_raw r
    on r.catalog_id = c.catalog_id and r.variant = 'normal' and r.condition = 'NM'
  left join public.prices_graded g10
    on g10.catalog_id = c.catalog_id and g10.company = 'PSA' and g10.grade = '10' and g10.variant = 'normal'
  left join public.prices_graded g9
    on g9.catalog_id = c.catalog_id and g9.company = 'PSA' and g9.grade = '9' and g9.variant = 'normal'
  where c.catalog_id = any(ids);
$$;

create or replace function public.get_price_refresh_queue(
  stale_before timestamptz,
  row_limit integer default 500
)
returns table (
  catalog_id text,
  game public.tcg_game,
  scrydex_id text,
  priority_score bigint
) language sql stable as $$
  select
    c.catalog_id,
    c.game,
    c.scrydex_id,
    coalesce(sum(a.hit_count), 0) + case when r.synced_at is null or r.synced_at < stale_before then 1000 else 0 end
      as priority_score
  from public.catalog_cards c
  left join public.prices_raw r
    on r.catalog_id = c.catalog_id and r.variant = 'normal' and r.condition = 'NM'
  left join public.card_activity a on a.catalog_id = c.catalog_id
  where r.synced_at is null or r.synced_at < stale_before
  group by c.catalog_id, c.game, c.scrydex_id, r.synced_at
  order by priority_score desc, c.catalog_id
  limit greatest(row_limit, 1);
$$;

create or replace function public.get_history_backfill_queue(
  row_limit integer default 100
)
returns table (
  catalog_id text,
  game public.tcg_game,
  scrydex_id text
) language sql stable as $$
  select c.catalog_id, c.game, c.scrydex_id
  from public.catalog_cards c
  inner join public.card_activity a on a.catalog_id = c.catalog_id
  where a.last_seen_at >= now() - interval '30 days'
    and not exists (
      select 1 from public.price_history_daily h
      where h.catalog_id = c.catalog_id
        and h.snapshot_date >= current_date - interval '7 days'
    )
  group by c.catalog_id, c.game, c.scrydex_id
  order by max(a.last_seen_at) desc
  limit greatest(row_limit, 1);
$$;

grant execute on function public.get_cards_with_prices_batch(text[]) to anon, authenticated, service_role;
grant execute on function public.get_price_refresh_queue(timestamptz, integer) to service_role;
grant execute on function public.get_history_backfill_queue(integer) to service_role;
