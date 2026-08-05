import "server-only";

import type { PoolClient } from "pg";
import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { getServerEnv } from "./env";
import {
  assertGitHubReleasePermissions,
  createGitHubInstallationToken,
  getGitHubInstallation,
  listGitHubInstallationRepositories,
} from "./github-app";

export interface GitHubConnectionSummary {
  id: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
  status: "active" | "suspended" | "disconnected";
  repositorySelection: "all" | "selected";
  lastSyncedAt: string;
  repositories: Array<{
    id: string;
    fullName: string;
    private: boolean;
    defaultBranch: string;
    enabled: boolean;
  }>;
}

interface ConnectionRow {
  id: string;
  github_installation_id: string;
  account_login: string;
  account_type: string;
  status: "active" | "suspended" | "disconnected";
  repository_selection: "all" | "selected";
  last_synced_at: Date;
}

export async function listOrganizationGitHubConnections(organizationId: string) {
  const installations = await getPool().query<ConnectionRow>(
    `select id, github_installation_id::text, account_login, account_type,
            status, repository_selection, last_synced_at
       from github_app_installations
      where organization_id = $1 and status <> 'disconnected'
      order by account_login, created_at`,
    [organizationId],
  );
  const repositories = await getPool().query<{
    id: string;
    installation_id: string;
    full_name: string;
    private: boolean;
    default_branch: string;
    enabled: boolean;
  }>(
    `select id, installation_id, full_name, private, default_branch, enabled
       from github_app_repositories
      where organization_id = $1
      order by lower(full_name)`,
    [organizationId],
  );
  return installations.rows.map((row): GitHubConnectionSummary => ({
    id: row.id,
    installationId: row.github_installation_id,
    accountLogin: row.account_login,
    accountType: row.account_type,
    status: row.status,
    repositorySelection: row.repository_selection,
    lastSyncedAt: row.last_synced_at.toISOString(),
    repositories: repositories.rows
      .filter((repository) => repository.installation_id === row.id)
      .map((repository) => ({
        id: repository.id,
        fullName: repository.full_name,
        private: repository.private,
        defaultBranch: repository.default_branch,
        enabled: repository.enabled,
      })),
  }));
}

async function persistInstallation(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  installationId: string;
}) {
  const installation = await getGitHubInstallation(input.installationId);
  assertGitHubReleasePermissions(installation);
  const access = await createGitHubInstallationToken(input.installationId);
  const repositories = await listGitHubInstallationRepositories(access.token);

  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into github_app_installations (
         organization_id, github_installation_id, account_login, account_type,
         status, repository_selection, permissions, created_by_operator_id,
         created_by_email, installed_at, last_synced_at, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, now(), now())
       on conflict (github_installation_id) do update set
         account_login = excluded.account_login,
         account_type = excluded.account_type,
         status = excluded.status,
         repository_selection = excluded.repository_selection,
         permissions = excluded.permissions,
         last_synced_at = now(),
         updated_at = now()
       where github_app_installations.organization_id = excluded.organization_id
       returning id`,
      [
        input.organizationId,
        installation.id,
        installation.account.login,
        installation.account.type,
        installation.suspended_at ? "suspended" : "active",
        installation.repository_selection,
        JSON.stringify(installation.permissions),
        input.operatorId,
        input.operatorEmail,
        installation.created_at,
      ],
    );
    if (!result.rows[0]) {
      throw new Error("This GitHub App installation is already owned by another SentinelOps organization.");
    }
    await syncRepositories(client, {
      organizationId: input.organizationId,
      installationId: result.rows[0].id,
      repositories,
    });
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "github.app_installation_synced",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        installationId: String(installation.id),
        accountLogin: installation.account.login,
        repositoryCount: repositories.length,
        tokenExpiresAt: access.expiresAt,
      },
    });
    return result.rows[0].id;
  });
}

async function syncRepositories(
  client: PoolClient,
  input: {
    organizationId: string;
    installationId: string;
    repositories: Awaited<ReturnType<typeof listGitHubInstallationRepositories>>;
  },
) {
  await client.query(
    `update github_app_repositories set enabled = false, updated_at = now()
      where installation_id = $1 and organization_id = $2`,
    [input.installationId, input.organizationId],
  );
  for (const repository of input.repositories) {
    const updated = await client.query(
      `update github_app_repositories
          set installation_id = $2,
              github_repository_id = $3,
              full_name = $4,
              owner_login = $5,
              name = $6,
              private = $7,
              default_branch = $8,
              enabled = true,
              last_synced_at = now(),
              updated_at = now()
        where organization_id = $1
          and (
            (installation_id = $2 and github_repository_id = $3)
            or lower(full_name) = lower($4)
          )
        returning id`,
      [
        input.organizationId,
        input.installationId,
        repository.id,
        repository.full_name,
        repository.owner.login,
        repository.name,
        repository.private,
        repository.default_branch,
      ],
    );
    if (updated.rows[0]) continue;
    try {
      await client.query(
        `insert into github_app_repositories (
         organization_id, installation_id, github_repository_id, full_name,
         owner_login, name, private, default_branch, enabled, last_synced_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, true, now())`,
        [
          input.organizationId,
          input.installationId,
          repository.id,
          repository.full_name,
          repository.owner.login,
          repository.name,
          repository.private,
          repository.default_branch,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Error(`Repository ${repository.full_name} is already connected to another organization.`);
      }
      throw error;
    }
  }
}

export async function connectGitHubInstallation(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  installationId: string;
}) {
  await persistInstallation(input);
  return listOrganizationGitHubConnections(input.organizationId);
}

export async function syncGitHubInstallation(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  connectionId: string;
}) {
  const found = await getPool().query<{ github_installation_id: string }>(
    `select github_installation_id::text
       from github_app_installations
      where id = $1 and organization_id = $2 and status <> 'disconnected'`,
    [input.connectionId, input.organizationId],
  );
  if (!found.rows[0]) throw new Error("GitHub connection was not found.");
  await persistInstallation({
    ...input,
    installationId: found.rows[0].github_installation_id,
  });
  return listOrganizationGitHubConnections(input.organizationId);
}

export async function resolveGitHubRepositoryCredential(input: {
  organizationId: string;
  repository: string;
}) {
  const result = await getPool().query<{ github_installation_id: string }>(
    `select installation.github_installation_id::text
       from github_app_repositories repository
       join github_app_installations installation
         on installation.id = repository.installation_id
        and installation.organization_id = repository.organization_id
      where repository.organization_id = $1
        and lower(repository.full_name) = lower($2)
        and repository.enabled = true
        and installation.status = 'active'
      limit 1`,
    [input.organizationId, input.repository],
  );
  const connection = result.rows[0];
  if (connection) {
    const access = await createGitHubInstallationToken(connection.github_installation_id);
    return { token: access.token, mode: "github_app" as const };
  }

  const env = getServerEnv();
  if (
    env.GITHUB_TOKEN && env.GITHUB_REPOSITORY &&
    env.GITHUB_REPOSITORY.toLowerCase() === input.repository.toLowerCase()
  ) {
    return { token: env.GITHUB_TOKEN, mode: "legacy_pat" as const };
  }
  throw new Error(`Repository ${input.repository} is not connected to this organization.`);
}
