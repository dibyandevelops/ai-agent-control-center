interface GitHubReleaseResponse {
  draft?: boolean;
  html_url?: string;
  tag_name?: string;
  message?: string;
}

class GitHubRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GitHubRequestError";
  }
}

async function githubRequest(
  token: string,
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "SentinelOps-Release-Worker",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({})) as GitHubReleaseResponse;
  if (!response.ok) {
    throw new GitHubRequestError(
      `GitHub request failed (${response.status}): ${payload.message ?? "Request failed."}`,
      response.status,
    );
  }
  return payload;
}

export async function createIdempotentGitHubDraftRelease(input: {
  token: string;
  repository: string;
  tagName: string;
  targetCommitish: string;
  changeTicket: string;
}) {
  const releasePath =
    `/repos/${input.repository}/releases/tags/${encodeURIComponent(input.tagName)}`;
  try {
    const existing = await githubRequest(input.token, releasePath);
    if (existing.draft !== true || !existing.html_url) {
      throw new Error(
        `GitHub release ${input.tagName} already exists and is not a draft.`,
      );
    }
    return {
      replayed: true,
      summary: `Existing GitHub draft release ${input.tagName} verified.`,
      externalReference: existing.html_url,
    };
  } catch (error) {
    if (!(error instanceof GitHubRequestError) || error.status !== 404) {
      throw error;
    }
  }

  const created = await githubRequest(
    input.token,
    `/repos/${input.repository}/releases`,
    {
      method: "POST",
      body: JSON.stringify({
        tag_name: input.tagName,
        target_commitish: input.targetCommitish,
        name: `${input.tagName} — SentinelOps governed release`,
        body: `Approved and executed by SentinelOps under change ticket ${input.changeTicket}.`,
        draft: true,
        prerelease: false,
        generate_release_notes: true,
      }),
    },
  );
  if (created.draft !== true || !created.html_url) {
    throw new Error("GitHub did not return the expected draft release.");
  }
  return {
    replayed: false,
    summary: `GitHub draft release ${input.tagName} created successfully.`,
    externalReference: created.html_url,
  };
}
