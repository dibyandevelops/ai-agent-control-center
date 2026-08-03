import { describe, expect, it, vi } from "vitest";
import { createGitHubReleaseClient } from "./github-release-client.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const configuration = {
  token: "test-token",
  repository: "example/sandbox",
};

describe("GitHub release client", () => {
  it("validates the exact writable repository", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        full_name: "example/sandbox",
        default_branch: "main",
        private: true,
        archived: false,
        html_url: "https://github.com/example/sandbox",
        permissions: { push: true },
      }),
    );
    const client = createGitHubReleaseClient({ ...configuration, fetchImpl });

    await expect(client.validateRepository()).resolves.toEqual({
      fullName: "example/sandbox",
      defaultBranch: "main",
      private: true,
      htmlUrl: "https://github.com/example/sandbox",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a token without repository write access", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        full_name: "example/sandbox",
        default_branch: "main",
        archived: false,
        permissions: { push: false },
      }),
    );
    const client = createGitHubReleaseClient({ ...configuration, fetchImpl });

    await expect(client.validateRepository()).rejects.toThrow("write access");
  });

  it("always creates a draft release", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Not Found" }, 404))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 42,
            tag_name: "v1.0.0-test",
            html_url: "https://github.com/example/sandbox/releases/tag/v1.0.0-test",
            draft: true,
          },
          201,
        ),
      );
    const client = createGitHubReleaseClient({ ...configuration, fetchImpl });

    const result = await client.createDraftRelease({
      tagName: "v1.0.0-test",
      targetCommitish: "main",
      name: "SentinelOps test",
      body: "Approved by SentinelOps.",
    });

    expect(result.draft).toBe(true);
    const request = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(request).toMatchObject({ draft: true, prerelease: false });
  });

  it("replays an existing draft without creating another release", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 42,
        tag_name: "v1.0.0-test",
        html_url: "https://github.com/example/sandbox/releases/tag/v1.0.0-test",
        draft: true,
      }),
    );
    const client = createGitHubReleaseClient({ ...configuration, fetchImpl });

    await expect(
      client.createDraftRelease({
        tagName: "v1.0.0-test",
        targetCommitish: "main",
      }),
    ).resolves.toMatchObject({ replayed: true, draft: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
