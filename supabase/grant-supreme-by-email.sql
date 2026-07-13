-- Grant CollecTools Supreme (owner tier) by email.
-- 1) Run supabase/supreme-plan.sql first (plan check constraint).
-- 2) Replace phpoke15@gmail.com, then run this in Supabase SQL Editor.
-- Also set Vercel env SUPREME_EMAILS=your@email.com (comma-separated allowlist).

select u.id, u.email, p.plan as profile_plan
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('phpoke15@gmail.com');

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower('phpoke15@gmail.com');
  if uid is null then
    raise exception 'No auth.users row for that email';
  end if;

  update public.profiles
  set plan = 'supreme', plan_updated_at = now()
  where id = uid;

  insert into public.subscriptions (
    user_id, stripe_subscription_id, status, plan,
    cancel_at_period_end, current_period_end, updated_at
  ) values (
    uid, 'comp_supreme_' || uid::text, 'active', 'supreme',
    false, now() + interval '100 years', now()
  )
  on conflict (stripe_subscription_id) do update
  set status = 'active',
      plan = 'supreme',
      cancel_at_period_end = false,
      current_period_end = excluded.current_period_end,
      updated_at = now();
end $$;

select u.email, p.plan as profile_plan, s.stripe_subscription_id, s.status, s.plan as sub_plan
from auth.users u
join public.profiles p on p.id = u.id
left join public.subscriptions s on s.user_id = u.id
where lower(u.email) = lower('phpoke15@gmail.com');
