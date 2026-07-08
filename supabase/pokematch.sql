-- PokeMatch social + matching schema
-- Run in Supabase SQL editor AFTER user_binders.sql

-- ─── Profiles ───────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text not null default '',
  bio text not null default '',
  location text not null default '',
  avatar_url text not null default '',
  binder_visibility text not null default 'public'
    check (binder_visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_handle_idx on public.profiles (handle);
create index if not exists profiles_display_name_idx on public.profiles (display_name);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  suffix int := 0;
  display text;
begin
  base_handle := lower(regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-z0-9]', '', 'g'));
  if base_handle = '' then base_handle := 'collector'; end if;
  final_handle := base_handle;
  while exists (select 1 from public.profiles where handle = final_handle) loop
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  end loop;
  display := split_part(coalesce(new.email, 'Collector'), '@', 1);
  insert into public.profiles (id, handle, display_name)
  values (new.id, final_handle, display)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for existing auth users
insert into public.profiles (id, handle, display_name)
select
  u.id,
  'user' || substr(replace(u.id::text, '-', ''), 1, 8),
  split_part(coalesce(u.email, 'Collector'), '@', 1)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ─── Friendships ─────────────────────────────────────────────────────────────

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

drop policy if exists "Users can view own friendships" on public.friendships;
drop policy if exists "Users can create friend requests" on public.friendships;
drop policy if exists "Users can update friendships they are part of" on public.friendships;
drop policy if exists "Users can delete friendships they are part of" on public.friendships;

create policy "Users can view own friendships"
  on public.friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can create friend requests"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = requester_id);

create policy "Users can update friendships they are part of"
  on public.friendships for update
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can delete friendships they are part of"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ─── Trades ──────────────────────────────────────────────────────────────────

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (initiator_id <> recipient_id)
);

create table if not exists public.trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  card_name text,
  card_set text,
  card_image text,
  created_at timestamptz not null default now()
);

create index if not exists trades_initiator_idx on public.trades (initiator_id);
create index if not exists trades_recipient_idx on public.trades (recipient_id);
create index if not exists trade_items_trade_idx on public.trade_items (trade_id);

alter table public.trades enable row level security;
alter table public.trade_items enable row level security;

drop policy if exists "Users can view own trades" on public.trades;
drop policy if exists "Users can create trades" on public.trades;
drop policy if exists "Users can update own trades" on public.trades;
drop policy if exists "Users can view trade items for own trades" on public.trade_items;
drop policy if exists "Users can insert trade items for own trades" on public.trade_items;

create policy "Users can view own trades"
  on public.trades for select
  to authenticated
  using (auth.uid() = initiator_id or auth.uid() = recipient_id);

create policy "Users can create trades"
  on public.trades for insert
  to authenticated
  with check (auth.uid() = initiator_id);

create policy "Users can update own trades"
  on public.trades for update
  to authenticated
  using (auth.uid() = initiator_id or auth.uid() = recipient_id);

create policy "Users can view trade items for own trades"
  on public.trade_items for select
  to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Users can insert trade items for own trades"
  on public.trade_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and t.initiator_id = auth.uid()
    )
  );

-- ─── Reviews ─────────────────────────────────────────────────────────────────

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid references public.trades(id) on delete set null,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);

create index if not exists reviews_reviewee_idx on public.reviews (reviewee_id);

alter table public.reviews enable row level security;

drop policy if exists "Reviews are viewable by authenticated users" on public.reviews;
drop policy if exists "Users can create reviews" on public.reviews;
drop policy if exists "Users can update own reviews" on public.reviews;

create policy "Reviews are viewable by authenticated users"
  on public.reviews for select
  to authenticated
  using (true);

create policy "Users can create reviews"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = reviewer_id);

create policy "Users can update own reviews"
  on public.reviews for update
  to authenticated
  using (auth.uid() = reviewer_id);

-- ─── Binder visibility helper ────────────────────────────────────────────────

create or replace function public.can_view_binder(owner_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  vis text;
begin
  if auth.uid() = owner_id then return true; end if;
  if auth.uid() is null then return false; end if;

  select binder_visibility into vis from public.profiles where id = owner_id;
  if vis is null or vis = 'public' then return true; end if;
  if vis = 'private' then return false; end if;

  return exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = owner_id)
        or (f.requester_id = owner_id and f.addressee_id = auth.uid())
      )
  );
end;
$$;

-- ─── user_binders: allow cross-user reads when visibility allows ─────────────

create index if not exists user_binders_card_status_idx
  on public.user_binders (card_id, status);
create index if not exists user_binders_user_status_idx
  on public.user_binders (user_id, status);

drop policy if exists "Users can view own binder" on public.user_binders;
drop policy if exists "Users can view visible binders" on public.user_binders;

create policy "Users can view own binder"
  on public.user_binders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can view visible binders"
  on public.user_binders for select
  to authenticated
  using (public.can_view_binder(user_id));
