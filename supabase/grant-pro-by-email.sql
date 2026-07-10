-- Force CollecTools Pro for one user (by email).
-- Replace YOUR_EMAIL_HERE, then run in Supabase SQL Editor.

-- 1) See what you have now
select u.id, u.email, p.handle, p.plan as profile_plan,
       s.stripe_subscription_id, s.status, s.plan as sub_plan, s.stripe_price_id, s.updated_at
from auth.users u
left join public.profiles p on p.id = u.id
left join public.subscriptions s on s.user_id = u.id
where lower(u.email) = lower('YOUR_EMAIL_HERE')
order by s.updated_at desc nulls last;

-- 2) Set profile + wipe conflicting active rows, then insert comp Pro
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower('YOUR_EMAIL_HERE');
  if uid is null then
    raise exception 'No auth.users row for that email';
  end if;

  update public.profiles
  set plan = 'pro', plan_updated_at = now()
  where id = uid;

  -- Demote other active/trialing rows so they cannot override Pro
  update public.subscriptions
  set status = 'canceled', updated_at = now()
  where user_id = uid
    and status in ('active', 'trialing')
    and stripe_subscription_id not like 'comp_pro_%';

  insert into public.subscriptions (
    user_id, stripe_subscription_id, status, plan,
    cancel_at_period_end, current_period_end, updated_at
  ) values (
    uid, 'comp_pro_' || uid::text, 'active', 'pro',
    false, now() + interval '100 years', now()
  )
  on conflict (stripe_subscription_id) do update
  set status = 'active',
      plan = 'pro',
      cancel_at_period_end = false,
      current_period_end = excluded.current_period_end,
      updated_at = now();
end $$;

-- 3) Confirm
select u.email, p.handle, p.plan as profile_plan,
       s.stripe_subscription_id, s.status, s.plan as sub_plan
from auth.users u
join public.profiles p on p.id = u.id
left join public.subscriptions s on s.user_id = u.id
where lower(u.email) = lower('YOUR_EMAIL_HERE');
