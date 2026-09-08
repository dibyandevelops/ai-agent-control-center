alter table organization_billing_accounts
  drop constraint if exists organization_billing_accounts_provider_check,
  drop constraint if exists organization_billing_accounts_subscription_status_check;

alter table organization_billing_accounts
  add constraint organization_billing_accounts_subscription_status_check
    check (subscription_status in ('not_configured', 'trialing', 'active', 'past_due', 'canceled', 'paused')),
  add column if not exists billing_interval text not null default 'month'
    check (billing_interval in ('month', 'year')),
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists card_brand text not null default 'visa',
  add column if not exists card_last4 text not null default '4242',
  add column if not exists card_exp text not null default '12/28',
  add column if not exists invoices jsonb not null default '[]'::jsonb;
