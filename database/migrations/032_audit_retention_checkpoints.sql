create table if not exists audit_retention_checkpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  start_event_id bigint not null,
  end_event_id bigint not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  event_count integer not null check (event_count > 0),
  terminal_hash text not null check (char_length(terminal_hash) = 64),
  pruned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists audit_retention_checkpoints_org_idx
  on audit_retention_checkpoints (organization_id, end_time desc);

comment on table audit_retention_checkpoints is
  'Cryptographic checkpoint seals anchoring pruned historical audit chains per organization retention policy.';
