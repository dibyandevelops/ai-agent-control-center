import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyGitHubReleaseMutation,
  verifyGitHubWebhookSignature,
} from "./github-release-webhook";

describe("GitHub release webhook", () => {
  it("validates the raw request body with a constant-time SHA-256 signature", () => {
    const secret = "It's a Secret to Everybody";
    const body = "Hello, World!";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyGitHubWebhookSignature({ secret, body, signature })).toBe(true);
    expect(verifyGitHubWebhookSignature({ secret, body: `${body}!`, signature })).toBe(false);
    expect(verifyGitHubWebhookSignature({ secret, body, signature: "sha1=invalid" })).toBe(false);
  });

  it("accepts only mutations with matching execution evidence", () => {
    expect(classifyGitHubReleaseMutation({
      action: "published",
      draft: false,
      draftCreationStatus: "succeeded",
      publicationStatus: "executing",
      cancellationStatus: null,
    }).outcome).toBe("authorized");
    expect(classifyGitHubReleaseMutation({
      action: "deleted",
      draft: true,
      draftCreationStatus: "succeeded",
      publicationStatus: null,
      cancellationStatus: "executing",
    }).outcome).toBe("authorized");
  });

  it("classifies direct publishing, editing, deletion, and unpublishing as drift", () => {
    for (const action of ["published", "edited", "deleted", "unpublished"] as const) {
      expect(classifyGitHubReleaseMutation({
        action,
        draft: action === "deleted",
        draftCreationStatus: "succeeded",
        publicationStatus: null,
        cancellationStatus: null,
      }).outcome).toBe("drift");
    }
  });
});
