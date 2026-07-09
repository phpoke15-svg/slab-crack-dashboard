-- Merge duplicate trade threads into one conversation per trader pair.
-- Run once in Supabase SQL editor after trade-messages.sql.
-- Safe to re-run: only affects pairs with more than one trade row.

do $$
declare
  pair record;
  keep_id uuid;
  drop_id uuid;
begin
  for pair in
    select
      least(initiator_id, recipient_id) as user_a,
      greatest(initiator_id, recipient_id) as user_b
    from public.trades
    group by least(initiator_id, recipient_id), greatest(initiator_id, recipient_id)
    having count(*) > 1
  loop
    select id
    into keep_id
    from public.trades
    where least(initiator_id, recipient_id) = pair.user_a
      and greatest(initiator_id, recipient_id) = pair.user_b
    order by updated_at desc nulls last, created_at desc
    limit 1;

    for drop_id in
      select id
      from public.trades
      where least(initiator_id, recipient_id) = pair.user_a
        and greatest(initiator_id, recipient_id) = pair.user_b
        and id <> keep_id
    loop
      update public.trade_messages
      set trade_id = keep_id
      where trade_id = drop_id;

      update public.reviews
      set trade_id = keep_id
      where trade_id = drop_id;

      delete from public.trade_items where trade_id = drop_id;
      delete from public.trades where id = drop_id;
    end loop;
  end loop;
end $$;
