create table if not exists github_app_installations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  github_installation_id bigint not null unique,
  account_login text not null,
  account_type text not null,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'disconnected')),
  repository_selection text not null
    check (repository_selection in ('all', 'selected')),
  permissions jsonb not null default '{}'::jsonb,
  created_by_operator_id uuid references operators(id) on delete set null,
  created_by_email text,
  installed_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, github_installation_id)
);

create table if not exists github_app_repositories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  installation_id uuid not null,
  github_repository_id bigint not null,
  full_name text not null,
  owner_login text not null,
  name text not null,
  private boolean not null default true,
  default_branch text not null default 'main',
  enabled boolean not null default true,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (installation_id, organization_id)
    references github_app_installations(id, organization_id) on delete cascade,
  unique (installation_id, github_repository_id)
);

create unique index if not exists github_app_repositories_full_name_idx
  on github_app_repositories (lower(full_name));

create index if not exists github_app_repositories_tenant_enabled_idx
  on github_app_repositories (organization_id, enabled, lower(full_name));

create index if not exists github_app_installations_tenant_status_idx
  on github_app_installations (organization_id, status, updated_at desc);

comment on table github_app_installations is
  'Organization-owned GitHub App installations. Short-lived access tokens are never persisted.';

comment on table github_app_repositories is
  'Repositories explicitly available to one tenant through its GitHub App installation.';
