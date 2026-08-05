create table if not exists slack_oauth_states (
  state_hash text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  operator_id uuid not null references operators(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists slack_oauth_states_unconsumed_expiry_idx
  on slack_oauth_states (expires_at)
  where consumed_at is null;

create table if not exists slack_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  team_id text not null,
  team_name text not null,
  channel_id text not null,
  channel_name text not null,
  webhook_ciphertext bytea not null,
  webhook_iv bytea not null,
  webhook_auth_tag bytea not null,
  status text not null default 'active'
    check (status in ('active', 'error', 'disconnected')),
  connected_by_operator_id uuid references operators(id) on delete set null,
  connected_by_email text,
  last_delivery_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists slack_connections_tenant_status_idx
  on slack_connections (organization_id, status, updated_at desc);

comment on table slack_connections is
  'Organization-owned Slack incoming-webhook destinations. Webhook URLs are encrypted with AES-256-GCM.';

comment on table slack_oauth_states is
  'One-time OAuth state challenges binding Slack installation callbacks to a SentinelOps tenant and operator.';
