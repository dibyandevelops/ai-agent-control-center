create table if not exists operator_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'approver'
    check (role in ('admin', 'approver', 'auditor')),
  token_hash text not null unique,
  invited_by_operator_id uuid references operators(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email))
);

create index if not exists operator_invitations_org_email_idx
  on operator_invitations (organization_id, email);

create index if not exists operator_invitations_active_idx
  on operator_invitations (token_hash, expires_at)
  where accepted_at is null and revoked_at is null;

comment on table operator_invitations is
  'Tenant-scoped operator invitations with hashed one-time tokens and lifecycle tracking.';
