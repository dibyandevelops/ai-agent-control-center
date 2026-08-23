-- Migration 034: Agent Emergency Quarantine Killswitch
alter table agents drop constraint if exists agents_status_check;
alter table agents add constraint agents_status_check
  check (status in ('healthy', 'review', 'blocked', 'quarantined'));

alter table agents add column if not exists quarantined_at timestamptz default null;
alter table agents add column if not exists quarantined_by text default null;
alter table agents add column if not exists quarantine_reason text default null;
