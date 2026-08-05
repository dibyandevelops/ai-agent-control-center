import { describe, expect, it } from "vitest";
import { canReviewReleaseGovernance } from "./release-governance";

describe("release draft four-eyes governance", () => {
  const request = {
    requestedByOperatorId: "maker-id",
    requestedByEmail: "maker@example.com",
  };

  it("prevents the maker from reviewing their own request", () => {
    expect(canReviewReleaseGovernance(request, {
      id: "maker-id",
      email: "maker@example.com",
    })).toBe(false);
  });

  it("allows a different administrator to review", () => {
    expect(canReviewReleaseGovernance(request, {
      id: "checker-id",
      email: "checker@example.com",
    })).toBe(true);
  });
});
