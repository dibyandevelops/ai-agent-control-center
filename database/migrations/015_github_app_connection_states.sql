create table if not exists github_app_connection_states (
  state_hash text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  operator_id uuid not null references operators(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists github_app_connection_states_expiry_idx
  on github_app_connection_states (expires_at)
  where consumed_at is null;

comment on table github_app_connection_states is
  'One-time state challenges that bind a GitHub installation flow to an authenticated SentinelOps tenant and operator.';
