-- Mailing addresses per party on accepted trades.
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.trades
  add column if not exists initiator_shipping_address text not null default '',
  add column if not exists recipient_shipping_address text not null default '';
