create table if not exists policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  policy_id uuid not null references policies(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  name text not null,
  description text not null,
  priority integer not null check (priority >= 0),
  effect text not null check (effect in ('allow', 'approval', 'block')),
  conditions jsonb not null,
  change_type text not null default 'edited'
    check (change_type in ('created', 'edited', 'rollback')),
  source_version_id uuid references policy_versions(id) on delete restrict,
  created_by_operator_id uuid references operators(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  unique (policy_id, version_number)
);

create index if not exists policy_versions_organization_policy_idx
  on policy_versions (organization_id, policy_id, version_number desc);

create index if not exists policy_versions_source_version_idx
  on policy_versions (source_version_id)
  where source_version_id is not null;

alter table policies
  add column if not exists active_version_id uuid
  references policy_versions(id) on delete restrict;

insert into policy_versions (
  organization_id,
  policy_id,
  version_number,
  name,
  description,
  priority,
  effect,
  conditions,
  change_type,
  created_by_email,
  created_at
)
select
  p.organization_id,
  p.id,
  1,
  p.name,
  p.description,
  p.priority,
  p.effect,
  p.conditions,
  'created',
  'migration@sentinelops.system',
  p.created_at
from policies p
where not exists (
  select 1
  from policy_versions pv
  where pv.policy_id = p.id
);

update policies p
set active_version_id = pv.id
from policy_versions pv
where pv.policy_id = p.id
  and pv.version_number = 1
  and p.enabled = true
  and p.active_version_id is null;

create index if not exists policies_active_version_idx
  on policies (active_version_id)
  where active_version_id is not null;

create table if not exists policy_activation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  policy_id uuid not null references policies(id) on delete cascade,
  version_id uuid not null references policy_versions(id) on delete restrict,
  requested_by_operator_id uuid references operators(id) on delete set null,
  requested_by_email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by_operator_id uuid references operators(id) on delete set null,
  reviewed_by_email text,
  review_reason text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by_email is null)
    or
    (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by_email is not null)
  ),
  check (
    reviewed_by_email is null
    or requested_by_email <> reviewed_by_email
  )
);

create unique index if not exists policy_activation_requests_one_pending_idx
  on policy_activation_requests (policy_id)
  where status = 'pending';

create index if not exists policy_activation_requests_org_status_idx
  on policy_activation_requests (organization_id, status, requested_at desc);

create index if not exists policy_activation_requests_version_idx
  on policy_activation_requests (version_id);

alter table action_requests
  add column if not exists policy_version_id uuid
  references policy_versions(id) on delete set null;

create index if not exists action_requests_policy_version_idx
  on action_requests (policy_version_id)
  where policy_version_id is not null;

comment on table policy_versions is
  'Immutable policy configuration snapshots used for approval, audit, and rollback.';

comment on table policy_activation_requests is
  'Four-eyes approval requests. The requester cannot review their own activation.';
