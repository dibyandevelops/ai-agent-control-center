import { afterEach, describe, expect, it, vi } from "vitest";
import { createIdempotentGitHubDraftRelease } from "./github-draft-release";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub draft release execution", () => {
  it("reuses an existing draft instead of creating a duplicate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      draft: true,
      tag_name: "v1.2.3",
      html_url: "https://github.com/example/releases/1",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createIdempotentGitHubDraftRelease({
      token: "test-token",
      repository: "example/releases",
      tagName: "v1.2.3",
      targetCommitish: "main",
      changeTicket: "CHG-42",
    });

    expect(result.replayed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates only a draft when the tag does not exist", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        draft: true,
        tag_name: "v1.2.3",
        html_url: "https://github.com/example/releases/2",
      }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createIdempotentGitHubDraftRelease({
      token: "test-token",
      repository: "example/releases",
      tagName: "v1.2.3",
      targetCommitish: "main",
      changeTicket: "CHG-42",
    });

    expect(result.replayed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const createRequest = fetchMock.mock.calls[1];
    expect(createRequest[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(createRequest[1]?.body))).toMatchObject({
      tag_name: "v1.2.3",
      draft: true,
      prerelease: false,
    });
  });
});
