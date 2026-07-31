alter table action_requests
  add column if not exists execution_status text not null default 'not_started',
  add column if not exists execution_started_at timestamptz,
  add column if not exists execution_completed_at timestamptz,
  add column if not exists execution_external_reference text,
  add column if not exists execution_summary text,
  add column if not exists execution_error_code text;

alter table action_requests
  drop constraint if exists action_requests_execution_status_check;

alter table action_requests
  add constraint action_requests_execution_status_check
  check (
    execution_status in (
      'not_started',
      'executing',
      'succeeded',
      'failed',
      'cancelled'
    )
  );

alter table action_requests
  drop constraint if exists action_requests_execution_timestamps_check;

alter table action_requests
  add constraint action_requests_execution_timestamps_check
  check (
    (
      execution_status = 'not_started'
      and execution_started_at is null
      and execution_completed_at is null
    )
    or (
      execution_status = 'executing'
      and execution_started_at is not null
      and execution_completed_at is null
    )
    or (
      execution_status in ('succeeded', 'failed', 'cancelled')
      and execution_started_at is not null
      and execution_completed_at is not null
    )
  );

create index if not exists action_requests_active_execution_idx
  on action_requests (organization_id, execution_status, execution_started_at desc)
  where execution_status <> 'not_started';

comment on column action_requests.execution_status is
  'Agent-reported execution lifecycle after an allowed or approved decision.';
