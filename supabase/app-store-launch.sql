-- CollecTools App Store launch (run once in Supabase SQL Editor)

-- Apple IAP columns on subscriptions
alter table public.subscriptions
  add column if not exists store text not null default 'stripe';

alter table public.subscriptions
  drop constraint if exists subscriptions_store_check;

alter table public.subscriptions
  add constraint subscriptions_store_check
  check (store in ('stripe', 'apple'));

alter table public.subscriptions
  add column if not exists apple_original_transaction_id text;

alter table public.subscriptions
  add column if not exists apple_product_id text;

alter table public.subscriptions
  alter column stripe_subscription_id drop not null;

create unique index if not exists subscriptions_apple_original_tx_uidx
  on public.subscriptions (apple_original_transaction_id)
  where apple_original_transaction_id is not null;

-- Push subscriptions (if missing optional columns)
alter table public.push_subscriptions
  add column if not exists social_alerts boolean not null default true;

alter table public.push_subscriptions
  add column if not exists price_alerts boolean not null default true;

alter table public.push_subscriptions
  add column if not exists giveaway_reminders boolean not null default false;

-- After running this file, call:
-- curl -X POST https://www.collectools.app/api/admin/app-store-setup -H "Authorization: Bearer $CRON_SECRET"
