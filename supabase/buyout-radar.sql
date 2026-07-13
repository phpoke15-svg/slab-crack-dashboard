-- Market Buyout & Speculation Radar
-- Tables map to the feature model: cards, sales_transactions, anomalies_log.
-- Prefixed buyout_* to avoid colliding with slab_cards / other app tables.
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) cards
-- ---------------------------------------------------------------------------
create table if not exists public.buyout_cards (
  id text primary key,
  name text not null,
  set_name text not null,
  release_date date,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists buyout_cards_set_idx
  on public.buyout_cards (set_name);

-- ---------------------------------------------------------------------------
-- 2) sales_transactions
-- ---------------------------------------------------------------------------
create table if not exists public.buyout_sales_transactions (
  id uuid primary key default gen_random_uuid(),
  card_id text not null references public.buyout_cards(id) on delete cascade,
  quantity_purchased integer not null check (quantity_purchased > 0),
  total_price numeric(12, 2) not null check (total_price >= 0),
  buyer_ip_hash text not null,
  purchased_at timestamptz not null default now()
);

create index if not exists buyout_sales_card_time_idx
  on public.buyout_sales_transactions (card_id, purchased_at desc);

create index if not exists buyout_sales_time_idx
  on public.buyout_sales_transactions (purchased_at desc);

create index if not exists buyout_sales_buyer_idx
  on public.buyout_sales_transactions (buyer_ip_hash);

-- ---------------------------------------------------------------------------
-- 3) anomalies_log
-- ---------------------------------------------------------------------------
create table if not exists public.buyout_anomalies_log (
  id uuid primary key default gen_random_uuid(),
  card_id text not null references public.buyout_cards(id) on delete cascade,
  detected_at timestamptz not null default now(),
  priority text not null check (priority in ('critical', 'high', 'warning')),
  recommended_action text not null,
  current_volume integer not null,
  baseline_volume numeric(12, 4) not null,
  volume_multiple numeric(12, 4) not null,
  unique_buyers integer not null,
  buyer_concentration_index numeric(8, 4) not null,
  buyout_probability_percentage numeric(6, 2) not null,
  window_hours integer not null default 24,
  notes text,
  active boolean not null default true
);

create index if not exists buyout_anomalies_active_idx
  on public.buyout_anomalies_log (active, detected_at desc);

create index if not exists buyout_anomalies_card_idx
  on public.buyout_anomalies_log (card_id, detected_at desc);

-- ---------------------------------------------------------------------------
-- Detector: rolling 24h volume vs 14-day daily avg + buyer concentration
-- ---------------------------------------------------------------------------
create or replace function public.detect_buyout_risks(
  p_window_hours integer default 24,
  p_baseline_days integer default 14,
  p_volume_multiple_threshold numeric default 2.5,
  p_max_unique_buyers integer default 2
)
returns table (
  card_id text,
  card_name text,
  set_name text,
  release_date date,
  image_url text,
  current_volume integer,
  baseline_volume numeric,
  volume_multiple numeric,
  unique_buyers integer,
  buyer_concentration_index numeric,
  buyout_probability_percentage numeric,
  priority text,
  recommended_action text
)
language sql
stable
as $$
  with bounds as (
    select
      now() as as_of,
      now() - make_interval(hours => p_window_hours) as window_start,
      now() - make_interval(days => p_baseline_days) as baseline_start,
      now() - make_interval(hours => p_window_hours) as baseline_end
  ),
  window_stats as (
    select
      s.card_id,
      sum(s.quantity_purchased)::integer as current_volume,
      count(distinct s.buyer_ip_hash)::integer as unique_buyers
    from public.buyout_sales_transactions s
    cross join bounds b
    where s.purchased_at >= b.window_start
      and s.purchased_at <= b.as_of
    group by s.card_id
  ),
  baseline_stats as (
    select
      s.card_id,
      -- Average daily quantity over the baseline window (exclude the live window).
      (sum(s.quantity_purchased)::numeric
        / greatest(p_baseline_days - (p_window_hours::numeric / 24.0), 1)
      ) as baseline_daily_avg
    from public.buyout_sales_transactions s
    cross join bounds b
    where s.purchased_at >= b.baseline_start
      and s.purchased_at < b.baseline_end
    group by s.card_id
  ),
  scored as (
    select
      c.id as card_id,
      c.name as card_name,
      c.set_name,
      c.release_date,
      c.image_url,
      coalesce(w.current_volume, 0) as current_volume,
      round(coalesce(b.baseline_daily_avg, 0), 4) as baseline_volume,
      case
        when coalesce(b.baseline_daily_avg, 0) <= 0 then
          case when coalesce(w.current_volume, 0) >= 10 then 99.0 else 0.0 end
        else round(w.current_volume::numeric / nullif(b.baseline_daily_avg, 0), 4)
      end as volume_multiple,
      coalesce(w.unique_buyers, 0) as unique_buyers,
      -- 0 = dispersed buyers, 1 = single-buyer concentration.
      case
        when coalesce(w.current_volume, 0) <= 0 then 0
        else round(
          1.0 - (coalesce(w.unique_buyers, 0)::numeric / w.current_volume::numeric),
          4
        )
      end as buyer_concentration_index
    from public.buyout_cards c
    left join window_stats w on w.card_id = c.id
    left join baseline_stats b on b.card_id = c.id
  ),
  flagged as (
    select
      s.*,
      -- Probability blends volume spike + concentration + low unique-buyer count.
      least(
        99.9,
        greatest(
          0,
          round(
            (
              least(s.volume_multiple / 10.0, 1.0) * 55
              + s.buyer_concentration_index * 30
              + case
                  when s.unique_buyers between 1 and p_max_unique_buyers then 15
                  when s.unique_buyers <= 4 then 8
                  else 0
                end
            )::numeric,
            2
          )
        )
      ) as buyout_probability_percentage
    from scored s
    where s.current_volume > 0
      and s.volume_multiple >= p_volume_multiple_threshold
      and s.unique_buyers > 0
      and s.unique_buyers <= p_max_unique_buyers
  )
  select
    f.card_id,
    f.card_name,
    f.set_name,
    f.release_date,
    f.image_url,
    f.current_volume,
    f.baseline_volume,
    f.volume_multiple,
    f.unique_buyers,
    f.buyer_concentration_index,
    f.buyout_probability_percentage,
    case
      when f.volume_multiple >= 8 and f.buyout_probability_percentage >= 75 then 'critical'
      when f.volume_multiple >= 5 or f.buyout_probability_percentage >= 72 then 'high'
      else 'warning'
    end as priority,
    case
      when f.buyout_probability_percentage >= 85 then 'Speculative Buy'
      when f.volume_multiple >= 8 and f.buyer_concentration_index >= 0.85 then 'Speculative Buy'
      when f.buyout_probability_percentage >= 70 then 'Accumulate Quietly'
      else 'Monitor / Alert'
    end as recommended_action
  from flagged f
  order by f.buyout_probability_percentage desc, f.volume_multiple desc;
$$;

-- Persist latest detector results into anomalies_log (deactivates prior open rows).
create or replace function public.refresh_buyout_anomalies()
returns integer
language plpgsql
as $$
declare
  inserted integer := 0;
begin
  update public.buyout_anomalies_log
  set active = false
  where active = true;

  insert into public.buyout_anomalies_log (
    card_id,
    priority,
    recommended_action,
    current_volume,
    baseline_volume,
    volume_multiple,
    unique_buyers,
    buyer_concentration_index,
    buyout_probability_percentage,
    window_hours,
    notes,
    active
  )
  select
    d.card_id,
    d.priority,
    d.recommended_action,
    d.current_volume,
    d.baseline_volume,
    d.volume_multiple,
    d.unique_buyers,
    d.buyer_concentration_index,
    d.buyout_probability_percentage,
    24,
    format(
      'Live window volume %s vs baseline daily avg %s (%sx). %s unique buyer hash(es).',
      d.current_volume,
      d.baseline_volume,
      d.volume_multiple,
      d.unique_buyers
    ),
    true
  from public.detect_buyout_risks() d;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

alter table public.buyout_cards enable row level security;
alter table public.buyout_sales_transactions enable row level security;
alter table public.buyout_anomalies_log enable row level security;

-- Service role writes; authenticated Supreme access goes through Next.js API (admin client).
revoke all on public.buyout_cards from anon, authenticated;
revoke all on public.buyout_sales_transactions from anon, authenticated;
revoke all on public.buyout_anomalies_log from anon, authenticated;

grant all on public.buyout_cards to service_role;
grant all on public.buyout_sales_transactions to service_role;
grant all on public.buyout_anomalies_log to service_role;
grant execute on function public.detect_buyout_risks(integer, integer, numeric, integer) to service_role;
grant execute on function public.refresh_buyout_anomalies() to service_role;
