-- CollecTools / PokeMatch — full chat setup
-- Run in Supabase SQL Editor AFTER pokematch.sql (needs public.trades).
-- Safe to re-run.

-- ─── Messages table ──────────────────────────────────────────────────────────

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

-- Add columns if upgrading from an older partial install
alter table public.trade_messages
  add column if not exists image_url text not null default '';

alter table public.trade_messages drop constraint if exists trade_messages_message_type_check;
alter table public.trade_messages add constraint trade_messages_message_type_check
  check (message_type in ('text', 'proposal', 'counter', 'status', 'image'));

create index if not exists trade_messages_trade_idx on public.trade_messages (trade_id, created_at);

alter table public.trade_messages enable row level security;

drop policy if exists "Trade participants can view messages" on public.trade_messages;
drop policy if exists "Trade participants can send messages" on public.trade_messages;

create policy "Trade participants can view messages"
  on public.trade_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Trade participants can send messages"
  on public.trade_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

-- ─── Trade items policy (counter-offers) ─────────────────────────────────────

drop policy if exists "Initiator can insert trade items" on public.trade_items;
drop policy if exists "Participants can manage pending trade items" on public.trade_items;

create policy "Participants can manage pending trade items"
  on public.trade_items for all
  to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and t.status = 'pending'
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and t.status = 'pending'
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

-- ─── Read receipts ───────────────────────────────────────────────────────────

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
  on public.trade_chat_reads for select
  to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Users can upsert own read state"
  on public.trade_chat_reads for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

-- ─── Realtime ────────────────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.trade_messages;
exception
  when duplicate_object then null;
end $$;

-- ─── Photo storage ───────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Trade participants can upload chat images" on storage.objects;
drop policy if exists "Trade participants can read chat images" on storage.objects;
drop policy if exists "Trade participants can delete own chat images" on storage.objects;

create policy "Trade participants can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.trades t
      where t.id::text = (storage.foldername(name))[1]
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Trade participants can read chat images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.trades t
      where t.id::text = (storage.foldername(name))[1]
        and (t.initiator_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Trade participants can delete own chat images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
