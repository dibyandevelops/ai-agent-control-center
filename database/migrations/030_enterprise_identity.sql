create table if not exists operator_password_resets (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists operator_password_resets_active_idx
  on operator_password_resets (token_hash, expires_at)
  where consumed_at is null;

comment on table operator_password_resets is
  'One-time hashed password reset tokens with short expiration for self-service recovery.';

alter table organization_identity_settings
  add column if not exists saml_enforced boolean not null default false,
  add column if not exists saml_cert_expires_at timestamptz;

comment on column organization_identity_settings.saml_enforced is
  'When true, operators must authenticate through the configured SAML IdP.';

comment on column organization_identity_settings.saml_cert_expires_at is
  'Expiration timestamp of the configured SAML IdP X.509 certificate for proactive alerting.';
