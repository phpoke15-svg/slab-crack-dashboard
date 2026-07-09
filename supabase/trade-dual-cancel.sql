-- Dual cancellation for trades — both parties must agree before status becomes "cancelled".
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.trades
  add column if not exists initiator_cancelled_at timestamptz,
  add column if not exists recipient_cancelled_at timestamptz;
