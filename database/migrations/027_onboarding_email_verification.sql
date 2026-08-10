alter table operators drop constraint if exists operators_status_check;
alter table operators add constraint operators_status_check
  check (status in ('active', 'disabled', 'pending_verification'));

create table if not exists onboarding_email_verifications (
  operator_id uuid primary key references operators(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_email_verifications_pending_idx
  on onboarding_email_verifications (expires_at)
  where verified_at is null;

comment on table onboarding_email_verifications is
  'One-time, hashed email-verification tokens for pending self-service tenant administrators.';
