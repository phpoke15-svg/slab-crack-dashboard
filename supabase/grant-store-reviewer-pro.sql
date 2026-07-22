-- Grant CollecTools Pro to the shared App Store / Google Play review account.
-- Safe to re-run after creating auth.users row for appreview@collectools.app
-- (or call POST /api/admin/setup-store-reviewer with CRON_SECRET).

do $$
declare
  uid uuid;
begin
  select id into uid
  from auth.users
  where lower(email) = lower('appreview@collectools.app');

  if uid is null then
    raise exception 'Create appreview@collectools.app in Supabase Auth first, or call /api/admin/setup-store-reviewer';
  end if;

  update public.profiles
  set plan = 'pro',
      display_name = 'App Review Demo',
      plan_updated_at = now()
  where id = uid;

  insert into public.profiles (id, handle, display_name, plan, plan_updated_at)
  values (uid, 'appreview', 'App Review Demo', 'pro', now())
  on conflict (id) do update
  set plan = 'pro',
      display_name = excluded.display_name,
      plan_updated_at = now();

  update public.subscriptions
  set status = 'canceled', updated_at = now()
  where user_id = uid
    and status in ('active', 'trialing')
    and stripe_subscription_id not like 'comp_reviewer_%';

  insert into public.subscriptions (
    user_id, stripe_subscription_id, status, plan,
    cancel_at_period_end, current_period_end, updated_at
  ) values (
    uid, 'comp_reviewer_' || uid::text, 'active', 'pro',
    false, now() + interval '100 years', now()
  )
  on conflict (stripe_subscription_id) do update
  set status = 'active',
      plan = 'pro',
      cancel_at_period_end = false,
      current_period_end = excluded.current_period_end,
      updated_at = now();
end $$;

select u.email, p.handle, p.plan as profile_plan, s.status, s.plan as sub_plan
from auth.users u
join public.profiles p on p.id = u.id
left join public.subscriptions s on s.user_id = u.id and s.status = 'active'
where lower(u.email) = lower('appreview@collectools.app');
