const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export class GitHubApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

export function createGitHubReleaseClient({
  token,
  repository,
  fetchImpl = fetch,
  apiVersion = "2022-11-28",
}) {
  if (!token?.trim()) throw new Error("GITHUB_TOKEN is required.");
  if (!repositoryPattern.test(repository ?? "")) {
    throw new Error("GITHUB_REPOSITORY must use the owner/repository format.");
  }

  const normalizedRepository = repository.toLowerCase();

  async function request(path, options = {}) {
    const response = await fetchImpl(`https://api.github.com${path}`, {
      ...options,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": apiVersion,
        "user-agent": "SentinelOps-MVP",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    let body = {};

    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new GitHubApiError(
        `GitHub returned a non-JSON response (${response.status}).`,
        response.status,
      );
    }

    if (!response.ok) {
      const message =
        typeof body.message === "string" ? body.message : "Request failed.";
      throw new GitHubApiError(
        `GitHub request failed (${response.status}): ${message}`,
        response.status,
      );
    }

    return body;
  }

  async function validateRepository() {
    const body = await request(`/repos/${repository}`);
    if (body.full_name?.toLowerCase() !== normalizedRepository) {
      throw new Error("GitHub returned a different repository than requested.");
    }
    if (body.archived) throw new Error("The configured GitHub repository is archived.");
    if (body.permissions?.push !== true) {
      throw new Error(
        "The GitHub token does not have write access to the configured repository.",
      );
    }

    return {
      fullName: body.full_name,
      defaultBranch: body.default_branch,
      private: body.private,
      htmlUrl: body.html_url,
    };
  }

  async function findReleaseByTag(tagName) {
    try {
      return await request(
        `/repos/${repository}/releases/tags/${encodeURIComponent(tagName)}`,
      );
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) return null;
      throw error;
    }
  }

  async function createDraftRelease({
    tagName,
    targetCommitish,
    name,
    body,
  }) {
    if (!tagName?.trim()) throw new Error("A release tag is required.");
    if (!targetCommitish?.trim()) throw new Error("A release target is required.");

    const existing = await findReleaseByTag(tagName);
    if (existing) {
      if (!existing.draft) {
        throw new Error(`GitHub release ${tagName} already exists and is published.`);
      }
      return {
        replayed: true,
        id: existing.id,
        tagName: existing.tag_name,
        htmlUrl: existing.html_url,
        draft: true,
      };
    }

    const created = await request(`/repos/${repository}/releases`, {
      method: "POST",
      body: JSON.stringify({
        tag_name: tagName,
        target_commitish: targetCommitish,
        name: name || tagName,
        body,
        draft: true,
        prerelease: false,
        generate_release_notes: true,
      }),
    });
    if (created.draft !== true || !created.html_url) {
      throw new Error("GitHub did not return the expected draft release.");
    }

    return {
      replayed: false,
      id: created.id,
      tagName: created.tag_name,
      htmlUrl: created.html_url,
      draft: true,
    };
  }

  return {
    repository,
    validateRepository,
    createDraftRelease,
  };
}
