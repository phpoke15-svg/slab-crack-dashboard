-- Scrydex multi-TCG catalog + pricing cache (Phase 1)
-- Run in Supabase SQL Editor AFTER unified-card-prices.sql
-- Safe to re-run (IF NOT EXISTS / idempotent patterns)

create extension if not exists pg_trgm;

do $$ begin
  create type public.tcg_game as enum ('pokemon', 'lorcana', 'mtg');
exception when duplicate_object then null;
end $$;

-- ─── Expansions ───────────────────────────────────────────────────────────────

create table if not exists public.expansions (
  id text primary key,
  game public.tcg_game not null,
  name text not null,
  series text,
  release_date date,
  total_cards integer,
  language_code text default 'EN',
  is_online_only boolean default false,
  metadata jsonb not null default '{}',
  synced_at timestamptz not null default now()
);

create index if not exists expansions_game_release_idx
  on public.expansions (game, release_date desc nulls last);

-- ─── Master catalog ───────────────────────────────────────────────────────────

create table if not exists public.catalog_cards (
  catalog_id text primary key,
  game public.tcg_game not null,
  scrydex_id text not null,
  name text not null,
  set_code text not null,
  set_name text not null,
  number text not null default '',
  printed_number text,
  rarity text,
  supertype text,
  subtypes text[] not null default '{}',
  language_code text default 'EN',
  image_small_url text,
  image_large_url text,
  variants text[] not null default '{}',
  metadata jsonb not null default '{}',
  search_vector tsvector,
  catalog_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game, scrydex_id)
);

create index if not exists catalog_cards_game_name_idx
  on public.catalog_cards (game, name);

create index if not exists catalog_cards_game_set_idx
  on public.catalog_cards (game, set_code, number);

create index if not exists catalog_cards_game_set_name_idx
  on public.catalog_cards (game, set_name);

create index if not exists catalog_cards_search_idx
  on public.catalog_cards using gin (search_vector);

create index if not exists catalog_cards_name_trgm_idx
  on public.catalog_cards using gin (name gin_trgm_ops);

-- ─── Raw prices (≥24h TTL enforced in app) ────────────────────────────────────

create table if not exists public.prices_raw (
  catalog_id text not null references public.catalog_cards(catalog_id) on delete cascade,
  variant text not null default 'normal',
  condition text not null default 'NM',
  currency text not null default 'USD',
  market_price numeric(12, 2),
  low_price numeric(12, 2),
  mid_price numeric(12, 2),
  source text not null default 'scrydex',
  synced_at timestamptz not null default now(),
  primary key (catalog_id, variant, condition)
);

create index if not exists prices_raw_stale_idx on public.prices_raw (synced_at);

-- ─── Graded prices ────────────────────────────────────────────────────────────

create table if not exists public.prices_graded (
  catalog_id text not null references public.catalog_cards(catalog_id) on delete cascade,
  variant text not null default 'normal',
  company text not null,
  grade text not null,
  currency text not null default 'USD',
  market_price numeric(12, 2),
  low_price numeric(12, 2),
  source text not null default 'scrydex',
  synced_at timestamptz not null default now(),
  primary key (catalog_id, variant, company, grade)
);

create index if not exists prices_graded_lookup_idx
  on public.prices_graded (catalog_id, company, grade);

-- ─── Daily price history ──────────────────────────────────────────────────────

create table if not exists public.price_history_daily (
  id bigserial primary key,
  catalog_id text not null references public.catalog_cards(catalog_id) on delete cascade,
  snapshot_date date not null,
  price_type text not null check (price_type in ('raw', 'graded')),
  variant text not null default 'normal',
  condition text,
  company text,
  grade text,
  market_price numeric(12, 2) not null,
  low_price numeric(12, 2),
  currency text not null default 'USD',
  source text not null default 'scrydex',
  captured_at timestamptz not null default now()
);

create unique index if not exists price_history_daily_unique_idx
  on public.price_history_daily (
    catalog_id,
    snapshot_date,
    price_type,
    variant,
    coalesce(condition, ''),
    coalesce(company, ''),
    coalesce(grade, '')
  );

create index if not exists price_history_card_date_idx
  on public.price_history_daily (catalog_id, snapshot_date desc);

-- ─── Population reports ───────────────────────────────────────────────────────

create table if not exists public.population_reports (
  catalog_id text not null references public.catalog_cards(catalog_id) on delete cascade,
  variant text not null default 'normal',
  company text not null,
  grade text not null,
  count integer not null default 0,
  grade_total integer,
  pop_total integer,
  synced_at timestamptz not null default now(),
  primary key (catalog_id, variant, company, grade)
);

-- ─── Hot-card activity (drives refresh priority) ──────────────────────────────

create table if not exists public.card_activity (
  catalog_id text not null references public.catalog_cards(catalog_id) on delete cascade,
  activity_type text not null,
  hit_count integer not null default 1,
  last_seen_at timestamptz not null default now(),
  primary key (catalog_id, activity_type)
);

create index if not exists card_activity_hot_idx
  on public.card_activity (last_seen_at desc);

-- ─── Resumable sync cursors ───────────────────────────────────────────────────

create table if not exists public.scrydex_sync_state (
  job_id text primary key,
  game public.tcg_game,
  expansion_id text,
  cursor_page integer not null default 1,
  cursor_token text,
  total_pages integer,
  status text not null default 'idle'
    check (status in ('idle', 'running', 'paused', 'complete', 'failed')),
  last_error text,
  credits_used integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ─── Credit ledger ────────────────────────────────────────────────────────────

create table if not exists public.api_credit_ledger (
  id bigserial primary key,
  provider text not null default 'scrydex',
  endpoint text not null,
  credits integer not null,
  game public.tcg_game,
  catalog_id text,
  job_id text,
  created_at timestamptz not null default now()
);

create index if not exists api_credit_ledger_day_idx
  on public.api_credit_ledger (created_at desc);

-- ─── Legacy ID bridge ─────────────────────────────────────────────────────────

create table if not exists public.catalog_id_legacy_map (
  legacy_id text primary key,
  catalog_id text not null references public.catalog_cards(catalog_id),
  legacy_source text not null,
  created_at timestamptz not null default now()
);

create index if not exists catalog_id_legacy_map_catalog_idx
  on public.catalog_id_legacy_map (catalog_id);

-- ─── Vision scan cache ────────────────────────────────────────────────────────

create table if not exists public.vision_scan_cache (
  phash text primary key,
  catalog_id text not null references public.catalog_cards(catalog_id),
  confidence numeric(4, 3),
  scanned_at timestamptz not null default now()
);

-- ─── Search vector trigger ──────────────────────────────────────────────────────

create or replace function public.catalog_cards_search_vector_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.set_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.number, '')), 'C');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists catalog_cards_search_vector_trg on public.catalog_cards;
create trigger catalog_cards_search_vector_trg
  before insert or update of name, set_name, number on public.catalog_cards
  for each row execute function public.catalog_cards_search_vector_update();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.expansions enable row level security;
alter table public.catalog_cards enable row level security;
alter table public.prices_raw enable row level security;
alter table public.prices_graded enable row level security;
alter table public.price_history_daily enable row level security;
alter table public.population_reports enable row level security;
alter table public.card_activity enable row level security;
alter table public.scrydex_sync_state enable row level security;
alter table public.api_credit_ledger enable row level security;
alter table public.catalog_id_legacy_map enable row level security;
alter table public.vision_scan_cache enable row level security;

grant select on public.expansions, public.catalog_cards, public.prices_raw,
  public.prices_graded, public.price_history_daily, public.population_reports
  to anon, authenticated;

grant all on public.expansions, public.catalog_cards, public.prices_raw,
  public.prices_graded, public.price_history_daily, public.population_reports,
  public.card_activity, public.scrydex_sync_state, public.api_credit_ledger,
  public.catalog_id_legacy_map, public.vision_scan_cache
  to service_role;

grant usage, select on sequence public.price_history_daily_id_seq to service_role;
grant usage, select on sequence public.api_credit_ledger_id_seq to service_role;

drop policy if exists "expansions_public_read" on public.expansions;
create policy "expansions_public_read" on public.expansions for select to anon, authenticated using (true);

drop policy if exists "catalog_cards_public_read" on public.catalog_cards;
create policy "catalog_cards_public_read" on public.catalog_cards for select to anon, authenticated using (true);

drop policy if exists "prices_raw_public_read" on public.prices_raw;
create policy "prices_raw_public_read" on public.prices_raw for select to anon, authenticated using (true);

drop policy if exists "prices_graded_public_read" on public.prices_graded;
create policy "prices_graded_public_read" on public.prices_graded for select to anon, authenticated using (true);

drop policy if exists "price_history_daily_public_read" on public.price_history_daily;
create policy "price_history_daily_public_read" on public.price_history_daily for select to anon, authenticated using (true);

drop policy if exists "population_reports_public_read" on public.population_reports;
create policy "population_reports_public_read" on public.population_reports for select to anon, authenticated using (true);
