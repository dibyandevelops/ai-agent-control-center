alter table operators
  add column if not exists failed_login_count integer not null default 0;

alter table operators
  add column if not exists failed_login_window_started_at timestamptz;

alter table operators
  add column if not exists locked_until timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operators_failed_login_count_nonnegative'
      and conrelid = 'operators'::regclass
  ) then
    alter table operators
      add constraint operators_failed_login_count_nonnegative
      check (failed_login_count >= 0);
  end if;
end $$;

comment on column operators.failed_login_count is
  'Failed password attempts in the current account-level rate window.';

comment on column operators.failed_login_window_started_at is
  'Start of the active failed-login counting window.';

comment on column operators.locked_until is
  'Protected login is denied until this timestamp after repeated failures.';
