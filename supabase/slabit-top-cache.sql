-- SlabIt daily top-100 cache (serverless-safe; run in Supabase SQL Editor)

create table if not exists public.slabit_top_cache (
  id text primary key default 'default',
  synced_at timestamptz not null,
  cards jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.slabit_top_cache enable row level security;

grant select on public.slabit_top_cache to anon, authenticated;
grant all on public.slabit_top_cache to service_role;

drop policy if exists "slabit_top_cache_public_read" on public.slabit_top_cache;
create policy "slabit_top_cache_public_read"
  on public.slabit_top_cache for select to anon, authenticated using (true);
