import "server-only";

import { getServerEnv } from "./env";
import { createGitHubAppJwt } from "./github-app-core";

export { createGitHubAppJwt } from "./github-app-core";

const githubApi = "https://api.github.com";
const githubApiVersion = "2022-11-28";

export interface GitHubInstallation {
  id: number;
  account: { login: string; type: string };
  repository_selection: "all" | "selected";
  permissions: Record<string, string>;
  created_at: string;
  suspended_at: string | null;
}

export interface GitHubInstallationRepository {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  owner: { login: string };
}

function appCredentials() {
  const env = getServerEnv();
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials are not configured.");
  }
  return { appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY };
}

async function githubRequest<T>(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${githubApi}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": githubApiVersion,
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body
      ? String(body.message)
      : `GitHub API returned ${response.status}.`;
    throw new Error(`GitHub App request failed: ${message}`);
  }
  return body as T;
}

function appJwt() {
  return createGitHubAppJwt(appCredentials());
}

export async function getGitHubInstallation(installationId: string) {
  return githubRequest<GitHubInstallation>(
    `/app/installations/${encodeURIComponent(installationId)}`,
    appJwt(),
  );
}

export async function createGitHubInstallationToken(installationId: string) {
  const result = await githubRequest<{ token: string; expires_at: string }>(
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    appJwt(),
    { method: "POST" },
  );
  return { token: result.token, expiresAt: result.expires_at };
}

export async function listGitHubInstallationRepositories(token: string) {
  const repositories: GitHubInstallationRepository[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await githubRequest<{
      total_count: number;
      repositories: GitHubInstallationRepository[];
    }>(`/installation/repositories?per_page=100&page=${page}`, token);
    repositories.push(...result.repositories);
    if (repositories.length >= result.total_count || result.repositories.length < 100) break;
  }
  return repositories;
}

export async function exchangeGitHubUserCode(code: string) {
  const env = getServerEnv();
  if (!env.GITHUB_APP_CLIENT_ID || !env.GITHUB_APP_CLIENT_SECRET) {
    throw new Error("GitHub App user authorization is not configured.");
  }
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      code,
    }),
  });
  const result = await response.json().catch(() => null) as {
    access_token?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !result?.access_token) {
    throw new Error(result?.error_description || "GitHub user authorization failed.");
  }
  return result.access_token;
}

export async function verifyGitHubUserInstallationAccess(
  userToken: string,
  installationId: string,
) {
  for (let page = 1; page <= 100; page += 1) {
    const result = await githubRequest<{
      total_count: number;
      installations: Array<{ id: number }>;
    }>(`/user/installations?per_page=100&page=${page}`, userToken);
    if (result.installations.some((installation) => String(installation.id) === installationId)) {
      return;
    }
    if (page * 100 >= result.total_count || result.installations.length < 100) break;
  }
  throw new Error("Your GitHub user is not authorized for this App installation.");
}

export function assertGitHubReleasePermissions(installation: GitHubInstallation) {
  if (installation.suspended_at) throw new Error("The GitHub App installation is suspended.");
  if (installation.permissions.contents !== "write") {
    throw new Error("The GitHub App requires repository Contents: read and write permission.");
  }
}
