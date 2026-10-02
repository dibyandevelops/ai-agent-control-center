alter table organization_billing_accounts
  drop constraint if exists organization_billing_accounts_provider_check,
  add constraint organization_billing_accounts_provider_check
    check (provider in ('stripe', 'paddle', 'dodopayments', 'lemonsqueezy')),
  add column if not exists provider_subscription_id text unique,
  add column if not exists provider_event_occurred_at timestamptz;

create table if not exists paddle_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
