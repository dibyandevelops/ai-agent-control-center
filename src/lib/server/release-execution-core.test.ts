import { describe, expect, it } from "vitest";
import {
  dryRunReleaseResult,
  resolveReleaseExecutionPlan,
} from "./release-execution-core";

describe("release execution planning", () => {
  it("builds a safe dry-run plan from an approved resource", () => {
    const plan = resolveReleaseExecutionPlan({
      mode: "dry_run",
      action: "deploy.release",
      resource: "dibyandevelops/sentinelops-release-sandbox@v1.2.3",
      context: { commitSha: "abc123", changeTicket: "CHG-42" },
    });

    expect(plan).toEqual({
      mode: "dry_run",
      repository: "dibyandevelops/sentinelops-release-sandbox",
      tagName: "v1.2.3",
      targetCommitish: "abc123",
      changeTicket: "CHG-42",
    });
    expect(dryRunReleaseResult(plan).externalReference).toBe(
      "dry-run://dibyandevelops/sentinelops-release-sandbox/v1.2.3",
    );
  });

  it("allows a syntactically valid tenant repository in GitHub mode", () => {
    expect(resolveReleaseExecutionPlan({
      mode: "github_draft",
      action: "deploy.release",
      resource: "example/other-repository@v1.0.0",
      context: {},
    }).repository).toBe("example/other-repository");
  });

  it("rejects unsupported actions and malformed release targets", () => {
    expect(() => resolveReleaseExecutionPlan({
      mode: "dry_run",
      action: "data.export",
      resource: "example/repository@v1.0.0",
      context: {},
    })).toThrow("does not support");
    expect(() => resolveReleaseExecutionPlan({
      mode: "dry_run",
      action: "deploy.release",
      resource: "example/repository",
      context: {},
    })).toThrow("repository@tag");
  });
});
