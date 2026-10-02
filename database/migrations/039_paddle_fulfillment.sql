alter table organizations
  drop constraint if exists organizations_plan_code_check;

alter table organizations
  add constraint organizations_plan_code_check
    check (plan_code in ('pilot', 'starter', 'pro', 'advanced', 'enterprise'));

create table if not exists customers (
  customer_id text primary key,
  organization_id uuid references organizations(id) on delete set null,
  email text,
  event_occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_organization_id_idx
  on customers (organization_id);

create table if not exists subscriptions (
  subscription_id text primary key,
  customer_id text not null references customers(customer_id) on delete restrict,
  organization_id uuid references organizations(id) on delete set null,
  status text not null,
  price_id text not null,
  product_id text not null,
  scheduled_change_action text,
  scheduled_change_at timestamptz,
  current_period_ends_at timestamptz,
  event_occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_customer_updated_idx
  on subscriptions (customer_id, updated_at desc);

create index if not exists subscriptions_organization_updated_idx
  on subscriptions (organization_id, updated_at desc);

create table if not exists paddle_transactions (
  transaction_id text primary key,
  customer_id text,
  subscription_id text,
  status text not null,
  event_occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paddle_transactions_subscription_idx
  on paddle_transactions (subscription_id, event_occurred_at desc);
