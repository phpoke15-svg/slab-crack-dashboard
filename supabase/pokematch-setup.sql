-- =============================================================================
-- PokeMatch — ONE-TIME SETUP (run entire file in Supabase SQL Editor)
-- Safe to re-run on existing projects (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- After running: wait ~30s for schema cache, then hard-refresh the app.
-- =============================================================================

-- ─── 1. User binders (I have / I want) ───────────────────────────────────────

create table if not exists public.user_binders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id text not null,
  status text not null,
  card_name text,
  card_set text,
  card_image text,
  card_rarity text,
  card_number text,
  created_at timestamptz default now(),
  unique (user_id, card_id)
);

alter table public.user_binders add column if not exists card_name text;
alter table public.user_binders add column if not exists card_set text;
alter table public.user_binders add column if not exists card_image text;
alter table public.user_binders add column if not exists card_rarity text;
alter table public.user_binders add column if not exists card_number text;

alter table public.user_binders drop constraint if exists user_binders_status_check;
alter table public.user_binders
  add constraint user_binders_status_check
  check (status in ('trade', 'wishlist', 'pending'));

alter table public.user_binders enable row level security;

drop policy if exists "Users can insert own binder cards" on public.user_binders;
drop policy if exists "Users can update own binder cards" on public.user_binders;
drop policy if exists "Users can delete own binder cards" on public.user_binders;

create policy "Users can insert own binder cards"
  on public.user_binders for insert
  with check (auth.uid() = user_id);

create policy "Users can update own binder cards"
  on public.user_binders for update
  using (auth.uid() = user_id);

create policy "Users can delete own binder cards"
  on public.user_binders for delete
  using (auth.uid() = user_id);

-- ─── 2. Profiles, friends, trades, reviews ─────────────────────────────────
-- (from pokematch.sql)

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
  on public.profiles for select to authenticated using (true);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

insert into public.profiles (id, handle, display_name)
select
  u.id,
  'user' || substr(replace(u.id::text, '-', ''), 1, 8),
  split_part(coalesce(u.email, 'Collector'), '@', 1)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

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
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can create friend requests"
  on public.friendships for insert to authenticated with check (auth.uid() = requester_id);

create policy "Users can update friendships they are part of"
  on public.friendships for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can delete friendships they are part of"
  on public.friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ─── 2b. Blocks and reports ───────────────────────────────────────────────────

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can view own blocks" on public.user_blocks;
drop policy if exists "Users can create own blocks" on public.user_blocks;
drop policy if exists "Users can delete own blocks" on public.user_blocks;
drop policy if exists "Users can see blocks targeting them" on public.user_blocks;

create policy "Users can view own blocks"
  on public.user_blocks for select to authenticated
  using (auth.uid() = blocker_id);

create policy "Users can create own blocks"
  on public.user_blocks for insert to authenticated
  with check (auth.uid() = blocker_id);

create policy "Users can delete own blocks"
  on public.user_blocks for delete to authenticated
  using (auth.uid() = blocker_id);

create policy "Users can see blocks targeting them"
  on public.user_blocks for select to authenticated
  using (auth.uid() = blocked_id);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'fraud', 'inappropriate', 'other')),
  details text not null default '',
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

create index if not exists user_reports_reported_idx on public.user_reports (reported_id, created_at desc);
create index if not exists user_reports_reporter_idx on public.user_reports (reporter_id, created_at desc);

alter table public.user_reports enable row level security;

drop policy if exists "Users can create reports" on public.user_reports;
drop policy if exists "Users can view own reports" on public.user_reports;

create policy "Users can create reports"
  on public.user_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy "Users can view own reports"
  on public.user_reports for select to authenticated
  using (auth.uid() = reporter_id);

grant all on public.user_blocks to service_role;
grant all on public.user_reports to service_role;

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
  on public.trades for select to authenticated
  using (auth.uid() = initiator_id or auth.uid() = recipient_id);

create policy "Users can create trades"
  on public.trades for insert to authenticated with check (auth.uid() = initiator_id);

create policy "Users can update own trades"
  on public.trades for update to authenticated
  using (auth.uid() = initiator_id or auth.uid() = recipient_id);

create policy "Users can view trade items for own trades"
  on public.trade_items for select to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Users can insert trade items for own trades"
  on public.trade_items for insert to authenticated
  with check (
    exists (
      select 1 from public.trades t
      where t.id = trade_id and t.initiator_id = auth.uid()
    )
  );

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
  on public.reviews for select to authenticated using (true);

create policy "Users can create reviews"
  on public.reviews for insert to authenticated with check (auth.uid() = reviewer_id);

create policy "Users can update own reviews"
  on public.reviews for update to authenticated using (auth.uid() = reviewer_id);

-- ─── 3. Trade extensions (accept, cancel, shipping, fulfillment) ─────────────

alter table public.trades
  add column if not exists initiator_accepted_at timestamptz,
  add column if not exists recipient_accepted_at timestamptz,
  add column if not exists initiator_cancelled_at timestamptz,
  add column if not exists recipient_cancelled_at timestamptz,
  add column if not exists fulfillment_addresses_at timestamptz,
  add column if not exists fulfillment_tracking_at timestamptz,
  add column if not exists fulfillment_received_at timestamptz,
  add column if not exists initiator_tracking text not null default '',
  add column if not exists recipient_tracking text not null default '',
  add column if not exists initiator_carrier text not null default '',
  add column if not exists recipient_carrier text not null default '',
  add column if not exists initiator_shipping_address text not null default '',
  add column if not exists recipient_shipping_address text not null default '';

-- ─── 4. Binder pending lock (requires trades table) ──────────────────────────

alter table public.user_binders
  add column if not exists pending_trade_id uuid references public.trades(id) on delete set null;

alter table public.user_binders
  add column if not exists pending_restore_status text;

alter table public.user_binders drop constraint if exists user_binders_pending_restore_status_check;
alter table public.user_binders
  add constraint user_binders_pending_restore_status_check
  check (pending_restore_status is null or pending_restore_status in ('trade', 'wishlist'));

create index if not exists user_binders_pending_trade_idx
  on public.user_binders (pending_trade_id)
  where pending_trade_id is not null;

-- ─── 5. Cross-user binder visibility ───────────────────────────────────────────

create or replace function public.can_view_binder(owner_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare vis text;
begin
  if auth.uid() = owner_id then return true; end if;
  if auth.uid() is null then return false; end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = owner_id)
       or (b.blocker_id = owner_id and b.blocked_id = auth.uid())
  ) then
    return false;
  end if;

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

drop policy if exists "Users can view own binder" on public.user_binders;
drop policy if exists "Users can view visible binders" on public.user_binders;

create policy "Users can view own binder"
  on public.user_binders for select to authenticated using (auth.uid() = user_id);

create policy "Users can view visible binders"
  on public.user_binders for select to authenticated using (public.can_view_binder(user_id));

create index if not exists user_binders_card_status_idx on public.user_binders (card_id, status);
create index if not exists user_binders_user_status_idx on public.user_binders (user_id, status);

-- ─── 6. Trade chat, read receipts, counter-offers ─────────────────────────────

create table if not exists public.trade_messages (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  image_url text not null default '',
  message_type text not null default 'text'
    check (message_type in ('text', 'proposal', 'counter', 'status', 'image')),
  created_at timestamptz not null default now()
);

alter table public.trade_messages add column if not exists image_url text not null default '';

alter table public.trade_messages drop constraint if exists trade_messages_message_type_check;
alter table public.trade_messages add constraint trade_messages_message_type_check
  check (message_type in ('text', 'proposal', 'counter', 'status', 'image'));

create index if not exists trade_messages_trade_idx on public.trade_messages (trade_id, created_at);

alter table public.trade_messages enable row level security;

drop policy if exists "Trade participants can view messages" on public.trade_messages;
drop policy if exists "Trade participants can send messages" on public.trade_messages;

create policy "Trade participants can view messages"
  on public.trade_messages for select to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Trade participants can send messages"
  on public.trade_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

drop policy if exists "Initiator can insert trade items" on public.trade_items;
drop policy if exists "Participants can manage pending trade items" on public.trade_items;

create policy "Participants can manage pending trade items"
  on public.trade_items for all to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id and t.status = 'pending'
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.trades t
      where t.id = trade_id and t.status = 'pending'
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create table if not exists public.trade_chat_reads (
  trade_id uuid not null references public.trades(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (trade_id, user_id)
);

create index if not exists trade_chat_reads_trade_idx on public.trade_chat_reads (trade_id);

alter table public.trade_chat_reads enable row level security;

drop policy if exists "Trade participants can view read state" on public.trade_chat_reads;
drop policy if exists "Users can upsert own read state" on public.trade_chat_reads;

create policy "Trade participants can view read state"
  on public.trade_chat_reads for select to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Users can upsert own read state"
  on public.trade_chat_reads for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.trade_messages;
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images', 'chat-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Trade participants can upload chat images" on storage.objects;
drop policy if exists "Trade participants can read chat images" on storage.objects;
drop policy if exists "Trade participants can delete own chat images" on storage.objects;

create policy "Trade participants can upload chat images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.trades t
      where t.id::text = (storage.foldername(name))[1]
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Trade participants can read chat images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.trades t
      where t.id::text = (storage.foldername(name))[1]
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Trade participants can delete own chat images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ─── 7. Daily price cache for matching ───────────────────────────────────────

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
  on public.binder_card_prices for select to anon, authenticated using (true);

-- Done. Reload PostgREST schema if errors persist: Settings → API → Reload schema
