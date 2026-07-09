-- Run once in Supabase SQL Editor if trade updates fail with missing column errors.
-- Safe to re-run.

-- Dual acceptance
alter table public.trades
  add column if not exists initiator_accepted_at timestamptz,
  add column if not exists recipient_accepted_at timestamptz;

-- Dual cancellation
alter table public.trades
  add column if not exists initiator_cancelled_at timestamptz,
  add column if not exists recipient_cancelled_at timestamptz;

-- Fulfillment checklist
alter table public.trades
  add column if not exists fulfillment_addresses_at timestamptz,
  add column if not exists fulfillment_tracking_at timestamptz,
  add column if not exists fulfillment_received_at timestamptz;

-- Shipping tracking
alter table public.trades
  add column if not exists initiator_tracking text not null default '',
  add column if not exists recipient_tracking text not null default '',
  add column if not exists initiator_carrier text not null default '',
  add column if not exists recipient_carrier text not null default '';

-- Mailing addresses
alter table public.trades
  add column if not exists initiator_shipping_address text not null default '',
  add column if not exists recipient_shipping_address text not null default '';
