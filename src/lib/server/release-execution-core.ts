export type ReleaseExecutionMode = "disabled" | "dry_run" | "github_draft";

export interface ReleaseExecutionPlan {
  mode: Exclude<ReleaseExecutionMode, "disabled">;
  repository: string;
  tagName: string;
  targetCommitish: string;
  changeTicket: string;
}

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const tagPattern = /^[A-Za-z0-9._-]{1,100}$/;
const commitishPattern = /^[A-Za-z0-9._/-]{1,200}$/;

function contextString(
  context: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = context[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function resolveReleaseExecutionPlan(input: {
  mode: Exclude<ReleaseExecutionMode, "disabled">;
  action: string;
  resource: string;
  context: Record<string, unknown>;
  configuredRepository?: string;
}): ReleaseExecutionPlan {
  if (!["deploy.release", "github.release.create"].includes(input.action)) {
    throw new Error(`Automated execution does not support ${input.action}.`);
  }

  const separator = input.resource.lastIndexOf("@");
  if (separator < 1 || separator === input.resource.length - 1) {
    throw new Error("Release resource must use repository@tag format.");
  }
  const requestedRepository = input.resource.slice(0, separator);
  const tagName = input.resource.slice(separator + 1);
  if (!repositoryPattern.test(requestedRepository)) {
    throw new Error("Release resource contains an invalid repository.");
  }
  if (!tagPattern.test(tagName)) {
    throw new Error("Release resource contains an invalid tag.");
  }

  const targetCommitish = contextString(input.context, [
    "commitSha",
    "targetCommitish",
    "commitish",
  ]) ?? "main";
  if (!commitishPattern.test(targetCommitish)) {
    throw new Error("Release target contains unsupported characters.");
  }
  const changeTicket = contextString(input.context, ["changeTicket"])
    ?? "SENTINELOPS-AUTO";

  if (input.mode === "github_draft") {
    if (!input.configuredRepository) {
      throw new Error("GITHUB_REPOSITORY is required for GitHub draft execution.");
    }
    if (
      requestedRepository.toLowerCase()
      !== input.configuredRepository.toLowerCase()
    ) {
      throw new Error(
        "Approved release repository does not match the configured GitHub repository.",
      );
    }
  }

  return {
    mode: input.mode,
    repository: requestedRepository,
    tagName,
    targetCommitish,
    changeTicket,
  };
}

export function dryRunReleaseResult(plan: ReleaseExecutionPlan) {
  return {
    summary:
      `Automated release dry run for ${plan.repository}@${plan.tagName} completed successfully; no GitHub write API was called.`,
    externalReference: `dry-run://${plan.repository}/${plan.tagName}`,
  };
}
