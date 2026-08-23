alter table notification_outbox drop constraint if exists notification_outbox_channel_check;
alter table notification_outbox add constraint notification_outbox_channel_check
  check (channel in ('slack', 'email', 'https'));

create table if not exists organization_https_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  destination_url text not null,
  secret_ciphertext bytea not null,
  secret_iv bytea not null,
  secret_auth_tag bytea not null,
  secret_prefix text not null check (char_length(secret_prefix) between 8 and 24),
  enabled boolean not null default true,
  last_delivered_at timestamptz,
  last_error text,
  created_by_operator_id uuid references operators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (organization_id, destination_url)
);

create index if not exists organization_https_webhooks_org_enabled_idx
  on organization_https_webhooks (organization_id, enabled)
  where revoked_at is null;

comment on table organization_https_webhooks is
  'Tenant-scoped HMAC-signed HTTPS destinations for governance event fan-out. Signing secrets are encrypted at rest.';
