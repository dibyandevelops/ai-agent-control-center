alter table operators
  add column if not exists password_change_required boolean;

alter table operators
  add column if not exists password_changed_at timestamptz;

-- Existing bootstrap accounts already chose their own password. Only accounts
-- created after this migration receive a temporary password by default.
update operators
set password_change_required = false,
    password_changed_at = coalesce(password_changed_at, updated_at)
where password_change_required is null;

alter table operators
  alter column password_change_required set default true,
  alter column password_change_required set not null;

comment on column operators.password_change_required is
  'Blocks protected access until the operator replaces a temporary password.';

comment on column operators.password_changed_at is
  'Timestamp of the latest successful operator password change.';
