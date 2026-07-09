-- Lock binder cards while a trade is accepted (both parties agreed).
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.user_binders drop constraint if exists user_binders_status_check;

alter table public.user_binders
  add constraint user_binders_status_check
  check (status in ('trade', 'wishlist', 'pending'));

alter table public.user_binders
  add column if not exists pending_trade_id uuid references public.trades(id) on delete set null;

alter table public.user_binders
  add column if not exists pending_restore_status text
  check (pending_restore_status is null or pending_restore_status in ('trade', 'wishlist'));

create index if not exists user_binders_pending_trade_idx
  on public.user_binders (pending_trade_id)
  where pending_trade_id is not null;
