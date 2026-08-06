alter table operators
  add column if not exists identity_source text not null default 'local'
    check (identity_source in ('local', 'scim')),
  add column if not exists external_identity_id text;

create unique index if not exists operators_organization_external_identity_uidx
  on operators (organization_id, external_identity_id)
  where external_identity_id is not null;

create table if not exists organization_identity_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  allowed_email_domains text[] not null default '{}'::text[],
  scim_token_hash text unique,
  scim_token_hint text,
  scim_token_created_at timestamptz,
  scim_token_created_by_operator_id uuid references operators(id) on delete set null,
  last_scim_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_identity_settings_scim_token_idx
  on organization_identity_settings (scim_token_hash)
  where scim_token_hash is not null;

comment on table organization_identity_settings is
  'Tenant-scoped identity policy and hashed SCIM bearer credential. Plain SCIM tokens are never stored.';

comment on column operators.identity_source is
  'The system that last provisioned the human operator account.';
