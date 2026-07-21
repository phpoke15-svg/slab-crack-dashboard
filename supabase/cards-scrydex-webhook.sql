-- Scrydex webhook support for public.cards (run in Supabase SQL Editor)

alter table public.cards
  add column if not exists scrydex_id text,
  add column if not exists clean_name text,
  add column if not exists current_price_raw numeric(10, 2),
  add column if not exists current_price_psa10 numeric(10, 2),
  add column if not exists price_updated_at timestamptz;

create index if not exists cards_scrydex_id_idx
  on public.cards (scrydex_id)
  where scrydex_id is not null;

create index if not exists cards_clean_name_prefix_idx
  on public.cards (clean_name text_pattern_ops)
  where clean_name is not null;

create index if not exists cards_current_price_raw_idx
  on public.cards (current_price_raw desc nulls last)
  where current_price_raw is not null;
