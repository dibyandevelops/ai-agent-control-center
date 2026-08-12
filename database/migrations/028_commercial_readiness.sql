alter table organizations
  add column if not exists plan_code text not null default 'pilot'
    check (plan_code in ('pilot', 'enterprise')),
  add column if not exists audit_retention_days integer not null default 90
    check (audit_retention_days between 30 and 3650);

create table if not exists organization_billing_accounts (
  organization_id uuid primary key references organizations(id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe')),
  provider_customer_id text unique,
  subscription_status text not null default 'not_configured'
    check (subscription_status in ('not_configured', 'trialing', 'active', 'past_due', 'canceled')),
  price_id text,
  current_period_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table organization_billing_accounts is
  'Stripe-ready billing identity only. Checkout and charging remain disabled until explicitly enabled.';
