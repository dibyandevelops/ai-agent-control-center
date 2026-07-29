create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  external_id text not null,
  name text not null,
  owner_email text not null,
  team text not null,
  provider text not null,
  environment text not null default 'development'
    check (environment in ('development', 'staging', 'production')),
  status text not null default 'healthy'
    check (status in ('healthy', 'review', 'blocked')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text not null,
  priority integer not null default 100 check (priority >= 0),
  effect text not null check (effect in ('allow', 'approval', 'block')),
  enabled boolean not null default true,
  conditions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists action_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete restrict,
  policy_id uuid references policies(id) on delete set null,
  idempotency_key text not null,
  action text not null,
  resource text not null,
  environment text not null
    check (environment in ('development', 'staging', 'production')),
  risk text not null check (risk in ('low', 'medium', 'high')),
  context jsonb not null default '{}'::jsonb,
  decision_status text not null
    check (decision_status in ('allowed', 'pending', 'approved', 'denied', 'blocked')),
  decision_reason text not null,
  decided_by text,
  decided_at timestamptz,
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (organization_id, idempotency_key)
);

create table if not exists audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  request_id uuid references action_requests(id) on delete set null,
  event_type text not null,
  actor_type text not null check (actor_type in ('agent', 'policy', 'human', 'system')),
  actor_id text not null,
  payload jsonb not null default '{}'::jsonb,
  previous_hash text,
  event_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_organization_id_idx
  on api_keys (organization_id);

create index if not exists agents_organization_id_idx
  on agents (organization_id);

create index if not exists policies_organization_priority_idx
  on policies (organization_id, enabled, priority);

create index if not exists action_requests_organization_requested_idx
  on action_requests (organization_id, requested_at desc, id desc);

create index if not exists action_requests_agent_id_idx
  on action_requests (agent_id);

create index if not exists action_requests_policy_id_idx
  on action_requests (policy_id);

create index if not exists action_requests_pending_idx
  on action_requests (organization_id, requested_at desc)
  where decision_status = 'pending';

create index if not exists audit_events_organization_created_idx
  on audit_events (organization_id, created_at desc, id desc);

create index if not exists audit_events_request_id_idx
  on audit_events (request_id);

comment on table audit_events is
  'Append-only, hash-chained evidence for agent requests and decisions.';
