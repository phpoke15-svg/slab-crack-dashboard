-- Collectr-style local card catalog (run in Supabase SQL Editor)
-- Static search index populated by scripts/import-pokemon-catalog.ts

create extension if not exists pg_trgm;

create table if not exists public.cards (
  id text primary key,
  name text not null,
  japanese_name text,
  set_name text not null,
  set_id text not null default '',
  number text not null default '',
  rarity text,
  image_url text,
  language text not null default 'en' check (language in ('en', 'ja')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_name_trgm_idx
  on public.cards using gin (name gin_trgm_ops);

create index if not exists cards_japanese_name_trgm_idx
  on public.cards using gin (japanese_name gin_trgm_ops);

create index if not exists cards_set_name_trgm_idx
  on public.cards using gin (set_name gin_trgm_ops);

create index if not exists cards_language_idx
  on public.cards (language);

alter table public.cards enable row level security;

grant select on public.cards to anon, authenticated;
grant all on public.cards to service_role;

drop policy if exists "cards_public_read" on public.cards;
create policy "cards_public_read"
  on public.cards for select
  to anon, authenticated
  using (true);
