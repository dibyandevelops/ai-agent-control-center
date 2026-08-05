alter table github_release_drift_incidents
  add column if not exists containment_resource text
    generated always as (repository || '@' || tag_name) stored,
  add column if not exists resolved_by_operator_id uuid
    references operators(id) on delete restrict,
  add column if not exists resolved_by_email text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text;

alter table github_release_drift_incidents
  drop constraint if exists github_release_drift_incidents_check;

alter table github_release_drift_incidents
  add constraint github_release_drift_incidents_lifecycle_check check (
    (
      status = 'open'
      and acknowledged_at is null
      and resolved_at is null
    )
    or
    (
      status = 'acknowledged'
      and acknowledged_at is not null
      and resolved_at is null
    )
    or
    (
      status = 'resolved'
      and acknowledged_at is not null
      and resolved_at is not null
    )
  );

drop index if exists github_release_drift_open_idx;

create index if not exists github_release_drift_active_idx
  on github_release_drift_incidents (
    organization_id, lower(containment_resource), detected_at desc
  )
  where severity = 'critical' and status in ('open', 'acknowledged');

create index if not exists github_release_drift_attention_idx
  on github_release_drift_incidents (
    organization_id, severity, detected_at desc
  )
  where status in ('open', 'acknowledged');

comment on column github_release_drift_incidents.containment_resource is
  'Canonical repository@tag target used to freeze release automation after critical drift.';

