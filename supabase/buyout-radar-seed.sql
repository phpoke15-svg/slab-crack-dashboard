-- Optional demo seed for Market Buyout Radar (run after buyout-radar.sql).
-- Safe to re-run: upserts cards, clears prior seed sales tagged by buyer hash prefix.

-- Drop legacy demo card ids that pointed at the wrong art / prints.
delete from public.buyout_sales_transactions
where card_id in ('sv8-161', 'sv3-215', 'sv4-253', 'swsh12-TG06', 'sv6-167', 'sv2-215', 'cel25-9');
delete from public.buyout_anomalies_log
where card_id in ('sv8-161', 'sv3-215', 'sv4-253', 'swsh12-TG06', 'sv6-167', 'sv2-215', 'cel25-9');
delete from public.buyout_cards
where id in ('sv8-161', 'sv3-215', 'sv4-253', 'swsh12-TG06', 'sv6-167', 'sv2-215', 'cel25-9');

insert into public.buyout_cards (id, name, set_name, release_date, image_url)
values
  ('sv8pt5-161', 'Umbreon ex', 'Prismatic Evolutions', '2025-01-17', 'https://images.pokemontcg.io/sv8pt5/161_hires.png'),
  ('sv3-223', 'Charizard ex', 'Obsidian Flames', '2023-08-11', 'https://images.pokemontcg.io/sv3/223_hires.png'),
  ('sv3pt5-151', 'Mew ex', '151', '2023-09-22', 'https://images.pokemontcg.io/sv3pt5/151_hires.png'),
  ('swsh4-44', 'Pikachu VMAX', 'Vivid Voltage', '2020-11-13', 'https://images.pokemontcg.io/swsh4/44_hires.png'),
  ('sv6-214', 'Greninja ex', 'Twilight Masquerade', '2024-05-24', 'https://images.pokemontcg.io/sv6/214_hires.png'),
  ('sv1-244', 'Miraidon ex', 'Scarlet & Violet', '2023-03-31', 'https://images.pokemontcg.io/sv1/244_hires.png')
on conflict (id) do update set
  name = excluded.name,
  set_name = excluded.set_name,
  release_date = excluded.release_date,
  image_url = excluded.image_url;

-- Wipe prior demo rows so re-seeds stay deterministic.
delete from public.buyout_sales_transactions
where buyer_ip_hash like 'retail-%'
   or buyer_ip_hash like 'buyout-%'
   or buyer_ip_hash like 'whale-%'
   or buyer_ip_hash like 'spec-%'
   or buyer_ip_hash like 'casual-%';

-- Quiet 14-day baselines at realistic NM raw unit prices.
insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  c.id,
  case when c.id in ('sv8pt5-161', 'sv3-223') then 2 else 1 end,
  case c.id
    when 'sv8pt5-161' then 1485
    when 'sv3-223' then 118
    when 'sv3pt5-151' then 42
    when 'swsh4-44' then 24
    when 'sv6-214' then 345
    else 58
  end * case when c.id in ('sv8pt5-161', 'sv3-223') then 2 else 1 end,
  'retail-' || c.id || '-' || d::text,
  now() - (d || ' days')::interval + interval '10 hours'
from public.buyout_cards c
cross join generate_series(2, 14) as d;

-- Critical Umbreon buyout (~$1.5k raw SIR).
insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  'sv8pt5-161',
  2,
  3080,
  'buyout-alpha-91f2',
  now() - (h || ' hours')::interval
from generate_series(0, 17) as h;

insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  'sv8pt5-161',
  1,
  1540,
  'buyout-beta-44aa',
  now() - ((i * 2.5) || ' hours')::interval
from generate_series(0, 5) as i;

-- High Charizard SIR sweep (~8×, not Critical).
insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  'sv3-223',
  2,
  270,
  'whale-char-7c01',
  now() - ((i * 2.4) || ' hours')::interval
from generate_series(0, 7) as i;

-- Warning Greninja SIR — just over 5× threshold.
insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  'sv6-214',
  2,
  744,
  case when i % 2 = 0 then 'spec-gren-a1' else 'spec-gren-b2' end,
  now() - ((i * 4.5) || ' hours')::interval
from generate_series(0, 3) as i;

select public.refresh_buyout_anomalies();
