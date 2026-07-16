-- User notifications + server watchlist + social/price push topics.
-- Run in Supabase SQL Editor once (safe to re-run).

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in ('friend_request', 'post_like', 'post_comment', 'price_alert')
  ),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text,
  entity_id text,
  title text not null,
  body text not null,
  url text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  dedupe_key text unique
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_unread_idx
  on public.user_notifications (user_id)
  where read_at is null;

create table if not exists public.user_card_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_id text not null,
  card_name text not null default '',
  tool text not null check (tool in ('slabcrack', 'slablab')),
  created_at timestamptz not null default now(),
  primary key (user_id, watchlist_id, tool)
);

create index if not exists user_card_watchlist_card_idx
  on public.user_card_watchlist (watchlist_id);

alter table public.push_subscriptions
  add column if not exists social_alerts boolean not null default true;

alter table public.push_subscriptions
  add column if not exists price_alerts boolean not null default true;

create index if not exists push_subscriptions_social_idx
  on public.push_subscriptions (social_alerts)
  where social_alerts = true;

create index if not exists push_subscriptions_price_idx
  on public.push_subscriptions (price_alerts)
  where price_alerts = true;

alter table public.user_notifications enable row level security;
alter table public.user_card_watchlist enable row level security;

grant select, update on public.user_notifications to authenticated;
grant select, insert, delete on public.user_card_watchlist to authenticated;
grant all on public.user_notifications to service_role;
grant all on public.user_card_watchlist to service_role;

drop policy if exists "user_notifications_own_read" on public.user_notifications;
create policy "user_notifications_own_read"
  on public.user_notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_notifications_own_update" on public.user_notifications;
create policy "user_notifications_own_update"
  on public.user_notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_watchlist_own" on public.user_card_watchlist;
create policy "user_watchlist_own"
  on public.user_card_watchlist for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
