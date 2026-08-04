create table if not exists notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('slack')),
  event_type text not null,
  dedupe_key text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'dead')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, dedupe_key),
  check (
    (status = 'processing' and locked_at is not null and locked_by is not null)
    or status <> 'processing'
  ),
  check (
    (status = 'delivered' and delivered_at is not null)
    or status <> 'delivered'
  )
);

create index if not exists notification_outbox_pending_available_idx
  on notification_outbox (available_at, created_at)
  where status = 'pending';

create index if not exists notification_outbox_processing_locked_idx
  on notification_outbox (locked_at)
  where status = 'processing';

create index if not exists notification_outbox_org_status_idx
  on notification_outbox (organization_id, status, updated_at desc);

comment on table notification_outbox is
  'Durable, deduplicated external notifications claimed by non-blocking workers.';
