-- pSEO slug columns for /pokemon/[set-slug]/[card-slug] landing pages
-- Run after supabase/cards-catalog.sql

alter table public.cards
  add column if not exists set_slug text,
  add column if not exists card_slug text;

create unique index if not exists cards_set_card_slug_uidx
  on public.cards (set_slug, card_slug)
  where set_slug is not null and card_slug is not null;

create index if not exists cards_set_slug_idx
  on public.cards (set_slug);
