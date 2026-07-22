-- Apple In-App Purchase columns for CollecTools subscriptions (safe to re-run).

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

create index if not exists subscriptions_apple_product_idx
  on public.subscriptions (apple_product_id)
  where apple_product_id is not null;
