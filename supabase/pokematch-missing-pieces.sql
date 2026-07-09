-- Minimal patch for the two setup-health gaps most often left after a partial pokematch-setup run.
-- Safe to re-run. Prefer full supabase/pokematch-setup.sql for a fresh project.

-- 1) Binder card numbers (needed for matching identity)
alter table public.user_binders
  add column if not exists card_number text;

-- 2) Daily price cache for matching / binder enrichment
create table if not exists public.binder_card_prices (
  card_id text primary key,
  raw_price numeric(10, 2) not null check (raw_price > 0),
  card_name text not null default '',
  card_set text not null default '',
  card_number text not null default '',
  synced_at timestamptz not null default now()
);

create index if not exists binder_card_prices_synced_at_idx
  on public.binder_card_prices (synced_at desc);

alter table public.binder_card_prices enable row level security;

grant select on public.binder_card_prices to anon, authenticated;
grant all on public.binder_card_prices to service_role;

drop policy if exists "binder_card_prices_public_read" on public.binder_card_prices;
create policy "binder_card_prices_public_read"
  on public.binder_card_prices for select
  to anon, authenticated
  using (true);

-- Optional: reload PostgREST schema cache if the health banner still shows after ~30s
-- notify pgrst, 'reload schema';
