-- Dual acceptance for trades — both parties must accept before status becomes "accepted".
-- Run in Supabase SQL Editor after pokematch.sql. Safe to re-run.

alter table public.trades
  add column if not exists initiator_accepted_at timestamptz,
  add column if not exists recipient_accepted_at timestamptz;

-- Trades already marked accepted only had one party confirm — clear so both must re-accept.
update public.trades
set
  initiator_accepted_at = null,
  recipient_accepted_at = null,
  status = 'pending'
where status = 'accepted';
