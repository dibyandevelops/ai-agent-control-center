alter table api_keys
  add column if not exists expires_at timestamptz;

update api_keys
set expires_at = now() + interval '90 days'
where expires_at is null
  and revoked_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'api_keys_expiration_after_creation_check'
      and conrelid = 'api_keys'::regclass
  ) then
    alter table api_keys
      add constraint api_keys_expiration_after_creation_check
      check (expires_at is null or expires_at > created_at);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'api_keys_active_requires_expiration_check'
      and conrelid = 'api_keys'::regclass
  ) then
    alter table api_keys
      add constraint api_keys_active_requires_expiration_check
      check (revoked_at is not null or expires_at is not null);
  end if;
end $$;

comment on column api_keys.expires_at is
  'When this agent credential stops authenticating. Null is retained only for revoked legacy records.';
