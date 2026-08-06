alter table organization_identity_settings
  add column if not exists session_max_duration_minutes integer not null default 480
    check (session_max_duration_minutes between 30 and 1440),
  add column if not exists session_idle_timeout_minutes integer not null default 60
    check (session_idle_timeout_minutes between 5 and 480),
  add constraint organization_identity_settings_session_timeout_order
    check (session_idle_timeout_minutes <= session_max_duration_minutes);

comment on column organization_identity_settings.session_max_duration_minutes is
  'Maximum absolute lifetime for a new operator browser session.';

comment on column organization_identity_settings.session_idle_timeout_minutes is
  'Maximum period with no authenticated request before an operator session is revoked.';
