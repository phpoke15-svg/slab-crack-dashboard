-- Chat experience: read receipts
-- Run after chat-upgrades.sql

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
