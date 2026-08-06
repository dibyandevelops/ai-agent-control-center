alter table organization_identity_settings
  add column if not exists saml_enabled boolean not null default false,
  add column if not exists saml_idp_entity_id text,
  add column if not exists saml_entry_point text,
  add column if not exists saml_idp_certificate text,
  add column if not exists saml_email_attribute text not null default 'email',
  add column if not exists saml_configured_at timestamptz,
  add column if not exists saml_configured_by_operator_id uuid references operators(id) on delete set null;

create table if not exists saml_login_requests (
  request_id text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  relay_state_hash text not null unique,
  value text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists saml_login_requests_active_idx
  on saml_login_requests (organization_id, expires_at)
  where consumed_at is null;

comment on table saml_login_requests is
  'Short-lived, tenant-bound SAML AuthnRequest correlation records for replay protection.';
