alter table organization_identity_settings
  add column if not exists mfa_required_for_sensitive_actions boolean not null default false;

alter table operator_sessions
  add column if not exists mfa_verified_at timestamptz;

create table if not exists operator_mfa (
  operator_id uuid primary key references operators(id) on delete cascade,
  encrypted_secret text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  recovery_code_hashes text[] not null default '{}'::text[],
  enabled_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table operator_mfa is
  'Encrypted TOTP secrets and one-time hashed recovery codes for operator step-up MFA.';
