alter table organization_identity_settings
  add column if not exists security_digest_channels text[] not null default array['slack','email']::text[]
    check (security_digest_channels <@ array['slack','email']::text[] and cardinality(security_digest_channels) > 0),
  add column if not exists security_digest_hour_utc integer not null default 8
    check (security_digest_hour_utc between 0 and 23);
