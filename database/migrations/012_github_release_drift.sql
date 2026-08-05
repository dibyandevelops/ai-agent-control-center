create table if not exists github_webhook_deliveries (
  delivery_id text primary key,
  organization_id uuid references organizations(id) on delete cascade,
  event_name text not null,
  event_action text,
  repository text,
  tag_name text,
  sender_login text,
  outcome text not null
    check (outcome in ('ignored', 'authorized', 'drift')),
  received_at timestamptz not null default now()
);

create table if not exists github_release_drift_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  action_request_id uuid references action_requests(id) on delete set null,
  delivery_id text not null unique
    references github_webhook_deliveries(delivery_id) on delete cascade,
  repository text not null,
  tag_name text not null,
  github_release_id bigint not null,
  event_action text not null,
  severity text not null check (severity in ('high', 'critical')),
  reason text not null,
  actor_login text not null,
  external_reference text,
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  detected_at timestamptz not null default now(),
  acknowledged_by_operator_id uuid references operators(id) on delete restrict,
  acknowledged_by_email text,
  acknowledged_at timestamptz,
  acknowledgment_note text,
  check (
    (status = 'open' and acknowledged_at is null)
    or
    (status in ('acknowledged', 'resolved') and acknowledged_at is not null)
  )
);

create index if not exists github_release_drift_open_idx
  on github_release_drift_incidents (
    organization_id, severity, detected_at desc
  )
  where status = 'open';

create index if not exists github_webhook_deliveries_received_idx
  on github_webhook_deliveries (received_at desc);

comment on table github_webhook_deliveries is
  'Deduplicated, signature-verified GitHub webhook delivery metadata.';

comment on table github_release_drift_incidents is
  'Release mutations observed in GitHub without matching SentinelOps authorization evidence.';
