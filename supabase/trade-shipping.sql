-- Outgoing tracking numbers per party on accepted trades.
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.trades
  add column if not exists initiator_tracking text not null default '',
  add column if not exists recipient_tracking text not null default '',
  add column if not exists initiator_carrier text not null default '',
  add column if not exists recipient_carrier text not null default '';
