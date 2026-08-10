create table if not exists onboarding_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default now()
);

comment on table onboarding_rate_limits is
  'Hashed, short-lived counters that throttle public workspace-creation attempts without retaining raw IP addresses or emails.';
