alter table action_requests
  add column if not exists execution_worker_id text,
  add column if not exists execution_locked_at timestamptz,
  add column if not exists execution_attempt_count integer not null default 0;

alter table action_requests
  drop constraint if exists action_requests_execution_attempt_count_check;

alter table action_requests
  add constraint action_requests_execution_attempt_count_check
  check (execution_attempt_count >= 0);

create index if not exists action_requests_release_execution_queue_idx
  on action_requests (requested_at asc, id asc)
  where decision_status = 'approved'
    and execution_status in ('not_started', 'executing')
    and action in ('deploy.release', 'github.release.create');

comment on column action_requests.execution_worker_id is
  'Ephemeral worker lease owner used to prevent duplicate automated release execution.';

comment on column action_requests.execution_locked_at is
  'Time the automated release worker most recently claimed this request.';

comment on column action_requests.execution_attempt_count is
  'Number of automated execution claims, including stale-lease recovery attempts.';
