alter table policy_activation_requests
  drop constraint if exists policy_activation_requests_status_check,
  drop constraint if exists policy_activation_requests_check;

alter table policy_activation_requests
  add column if not exists expires_at timestamptz not null
    default (now() + interval '24 hours'),
  add column if not exists next_reminder_at timestamptz not null
    default (now() + interval '4 hours'),
  add column if not exists last_reminded_at timestamptz,
  add column if not exists reminder_count integer not null default 0
    check (reminder_count >= 0),
  add column if not exists escalated_at timestamptz,
  add constraint policy_activation_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  add constraint policy_activation_requests_review_state_check
    check (
      (status = 'pending' and reviewed_at is null and reviewed_by_email is null)
      or
      (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by_email is not null)
      or
      (status = 'expired' and reviewed_at is not null and reviewed_by_email is null)
    );

create index if not exists policy_activation_requests_pending_deadline_idx
  on policy_activation_requests (next_reminder_at, expires_at)
  where status = 'pending';

comment on column policy_activation_requests.expires_at is
  'Deadline after which the proposed version can no longer be approved.';

comment on column policy_activation_requests.next_reminder_at is
  'Next time the scheduled reminder dispatcher should notify reviewers.';
