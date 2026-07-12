-- Optional demo seed for Market Buyout Radar (run after buyout-radar.sql).
-- Safe to re-run: upserts cards, clears prior seed sales tagged by buyer hash prefix.

insert into public.buyout_cards (id, name, set_name, release_date, image_url)
values
  ('sv8-161', 'Umbreon ex', 'Prismatic Evolutions', '2025-01-17', 'https://images.pokemontcg.io/sv8pt5/161_hires.png'),
  ('sv3-215', 'Charizard ex', 'Obsidian Flames', '2023-08-11', 'https://images.pokemontcg.io/sv3/215_hires.png'),
  ('sv4-253', 'Mew ex', 'Paradox Rift', '2023-11-03', 'https://images.pokemontcg.io/sv4/253_hires.png'),
  ('swsh12-TG06', 'Pikachu VMAX', 'Silver Tempest Trainer Gallery', '2022-11-11', 'https://images.pokemontcg.io/swsh12tg/TG06_hires.png'),
  ('sv6-167', 'Greninja ex', 'Twilight Masquerade', '2024-05-24', 'https://images.pokemontcg.io/sv6/167_hires.png'),
  ('sv2-215', 'Miraidon ex', 'Paldea Evolved', '2023-06-09', 'https://images.pokemontcg.io/sv2/215_hires.png')
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

-- Quiet 14-day baselines (approx).
insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  c.id,
  case when c.id in ('sv8-161', 'sv3-215') then 2 else 1 end,
  20,
  'retail-' || c.id || '-' || d::text,
  now() - (d || ' days')::interval + interval '10 hours'
from public.buyout_cards c
cross join generate_series(2, 14) as d;

-- Critical Umbreon buyout: many units, 2 hashes, last 24h.
insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  'sv8-161',
  2,
  190,
  'buyout-alpha-91f2',
  now() - (h || ' hours')::interval
from generate_series(0, 17) as h;

insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  'sv8-161',
  1,
  95,
  'buyout-beta-44aa',
  now() - ((i * 2.5) || ' hours')::interval
from generate_series(0, 5) as i;

-- High Charizard single-buyer sweep.
insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  'sv3-215',
  2,
  240,
  'whale-char-7c01',
  now() - ((i * 1.4) || ' hours')::interval
from generate_series(0, 13) as i;

-- Warning Greninja elevated two-buyer flow.
insert into public.buyout_sales_transactions (card_id, quantity_purchased, total_price, buyer_ip_hash, purchased_at)
select
  'sv6-167',
  2,
  70,
  case when i % 2 = 0 then 'spec-gren-a1' else 'spec-gren-b2' end,
  now() - ((i * 2.2) || ' hours')::interval
from generate_series(0, 7) as i;

-- Run detector into anomalies_log
select public.refresh_buyout_anomalies();
