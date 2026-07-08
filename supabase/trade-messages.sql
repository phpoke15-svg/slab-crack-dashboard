-- Trade chat messages (run after pokematch.sql)
-- Safe to re-run.

create table if not exists public.trade_messages (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  message_type text not null default 'text'
    check (message_type in ('text', 'proposal', 'counter', 'status')),
  created_at timestamptz not null default now()
);

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

-- Allow trade participants to update items on pending trades (counter-offers)
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
