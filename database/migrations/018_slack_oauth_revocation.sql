alter table slack_connections
  add column if not exists access_token_ciphertext bytea,
  add column if not exists access_token_iv bytea,
  add column if not exists access_token_auth_tag bytea;

comment on column slack_connections.access_token_ciphertext is
  'Encrypted Slack OAuth token retained only so SentinelOps can revoke the installation on disconnect.';
