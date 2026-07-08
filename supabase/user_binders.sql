-- Run in Supabase SQL editor (required for PokeMatch)

create table if not exists public.user_binders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id text not null,
  status text not null check (status in ('trade', 'wishlist')),
  card_name text,
  card_set text,
  card_image text,
  card_rarity text,
  created_at timestamptz default now(),
  unique (user_id, card_id)
);

-- Add metadata columns if the table already exists without them
alter table public.user_binders add column if not exists card_name text;
alter table public.user_binders add column if not exists card_set text;
alter table public.user_binders add column if not exists card_image text;
alter table public.user_binders add column if not exists card_rarity text;
alter table public.user_binders add column if not exists card_number text;

alter table public.user_binders enable row level security;

drop policy if exists "Users can view own binder" on public.user_binders;
drop policy if exists "Users can insert own binder cards" on public.user_binders;
drop policy if exists "Users can update own binder cards" on public.user_binders;
drop policy if exists "Users can delete own binder cards" on public.user_binders;

create policy "Users can view own binder"
  on public.user_binders for select
  using (auth.uid() = user_id);

create policy "Users can insert own binder cards"
  on public.user_binders for insert
  with check (auth.uid() = user_id);

create policy "Users can update own binder cards"
  on public.user_binders for update
  using (auth.uid() = user_id);

create policy "Users can delete own binder cards"
  on public.user_binders for delete
  using (auth.uid() = user_id);
