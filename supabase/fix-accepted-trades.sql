-- Restore trades both parties accepted but status was reset to pending.
-- Safe to re-run. Run in Supabase SQL Editor.

update public.trades
set status = 'accepted'
where status = 'pending'
  and initiator_accepted_at is not null
  and recipient_accepted_at is not null;
