-- Fixes the remaining setup-health gaps:
--   - Price cache (binder_card_prices)
--   - Chat read receipts (trade_chat_reads)
-- Safe to re-run.

-- 1) Daily price cache for matching / binder enrichment
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

-- 2) Chat read receipts
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

grant select, insert, update, delete on public.trade_chat_reads to authenticated;
grant all on public.trade_chat_reads to service_role;

-- Optional: reload PostgREST schema if the health banner still shows after ~30s
-- notify pgrst, 'reload schema';
