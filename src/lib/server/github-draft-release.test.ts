import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createIdempotentGitHubDraftRelease,
  transitionGitHubDraftRelease,
} from "./github-draft-release";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub draft governance execution", () => {
  it("publishes only an existing draft", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 42,
        draft: true,
        tag_name: "v1.2.3",
        html_url: "https://github.com/example/releases/42",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 42,
        draft: false,
        tag_name: "v1.2.3",
        html_url: "https://github.com/example/releases/42",
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await transitionGitHubDraftRelease({
      token: "test-token",
      repository: "example/releases",
      tagName: "v1.2.3",
      operation: "publish",
    });

    expect(result.replayed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      draft: false,
    });
  });

  it("cancels only an existing draft", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 43,
        draft: true,
        tag_name: "v1.2.4",
        html_url: "https://github.com/example/releases/43",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await transitionGitHubDraftRelease({
      token: "test-token",
      repository: "example/releases",
      tagName: "v1.2.4",
      operation: "cancel",
    });

    expect(result.replayed).toBe(false);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });

  it("refuses to cancel a published release", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 44,
      draft: false,
      tag_name: "v1.2.5",
      html_url: "https://github.com/example/releases/44",
    }), { status: 200 })));

    await expect(transitionGitHubDraftRelease({
      token: "test-token",
      repository: "example/releases",
      tagName: "v1.2.5",
      operation: "cancel",
    })).rejects.toThrow("published GitHub release cannot be cancelled");
  });
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
