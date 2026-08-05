drop index if exists github_app_repositories_full_name_idx;

create unique index github_app_repositories_full_name_idx
  on github_app_repositories (lower(full_name))
  where enabled = true;

comment on index github_app_repositories_full_name_idx is
  'Prevents an active repository from being connected to multiple SentinelOps tenants while allowing a disabled historical record.';
