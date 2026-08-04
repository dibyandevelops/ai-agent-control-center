create table if not exists operators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('admin', 'approver', 'auditor')),
  password_hash text not null,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email)),
  unique (organization_id, email)
);

create table if not exists operator_sessions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists operators_organization_role_idx
  on operators (organization_id, role, status);

create index if not exists operator_sessions_operator_idx
  on operator_sessions (operator_id, expires_at desc);

create index if not exists operator_sessions_active_expiry_idx
  on operator_sessions (expires_at)
  where revoked_at is null;

comment on table operators is
  'Organization-scoped human identities authorized to operate SentinelOps.';

comment on table operator_sessions is
  'Opaque, revocable browser sessions. Only SHA-256 token hashes are stored.';
