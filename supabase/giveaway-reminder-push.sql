-- Optional daily giveaway entry reminder push notifications (safe to re-run).

alter table public.push_subscriptions
  add column if not exists giveaway_reminders boolean not null default false;

create index if not exists push_subscriptions_giveaway_reminders_idx
  on public.push_subscriptions (giveaway_reminders)
  where giveaway_reminders = true;
