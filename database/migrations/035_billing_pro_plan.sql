alter table organizations
  drop constraint if exists organizations_plan_code_check;

alter table organizations
  add constraint organizations_plan_code_check
    check (plan_code in ('pilot', 'pro', 'enterprise'));
