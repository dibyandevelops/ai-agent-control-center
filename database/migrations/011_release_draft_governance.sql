create table if not exists release_draft_governance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  action_request_id uuid not null references action_requests(id) on delete cascade,
  operation text not null check (operation in ('publish', 'cancel')),
  status text not null default 'pending'
    check (status in (
      'pending', 'approved', 'rejected', 'expired',
      'executing', 'succeeded', 'failed'
    )),
  request_reason text not null,
  requested_by_operator_id uuid not null references operators(id) on delete restrict,
  requested_by_email text not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  reviewed_by_operator_id uuid references operators(id) on delete restrict,
  reviewed_by_email text,
  review_reason text,
  reviewed_at timestamptz,
  execution_worker_id text,
  execution_locked_at timestamptz,
  execution_attempt_count integer not null default 0
    check (execution_attempt_count >= 0),
  execution_started_at timestamptz,
  execution_completed_at timestamptz,
  execution_summary text,
  execution_error_code text,
  execution_external_reference text,
  check (
    reviewed_by_operator_id is null
    or requested_by_operator_id <> reviewed_by_operator_id
  ),
  check (
    reviewed_by_email is null
    or requested_by_email <> reviewed_by_email
  ),
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by_operator_id is null)
    or
    (status = 'expired' and reviewed_at is not null and reviewed_by_operator_id is null)
    or
    (status in ('approved', 'rejected', 'executing', 'succeeded', 'failed')
      and reviewed_at is not null and reviewed_by_operator_id is not null)
  )
);

create unique index if not exists release_draft_governance_one_active_idx
  on release_draft_governance_requests (action_request_id)
  where status in ('pending', 'approved', 'executing');

create index if not exists release_draft_governance_org_status_idx
  on release_draft_governance_requests (
    organization_id, status, requested_at desc
  );

create index if not exists release_draft_governance_worker_queue_idx
  on release_draft_governance_requests (requested_at asc, id asc)
  where status in ('approved', 'executing');

comment on table release_draft_governance_requests is
  'Independent four-eyes requests for publishing or cancelling GitHub draft releases.';

comment on column release_draft_governance_requests.requested_by_operator_id is
  'Maker identity. Database checks prevent this operator from reviewing the request.';
