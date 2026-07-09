-- Trade fulfillment checklist (after both parties accept).
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.trades
  add column if not exists fulfillment_addresses_at timestamptz,
  add column if not exists fulfillment_tracking_at timestamptz,
  add column if not exists fulfillment_received_at timestamptz;
