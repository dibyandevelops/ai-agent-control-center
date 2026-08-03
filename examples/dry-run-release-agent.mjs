import process from "node:process";
import { createGitHubReleaseClient } from "./github-release-client.mjs";

const apiKey = process.env.SENTINELOPS_AGENT_API_KEY;
const baseUrl = (process.env.SENTINELOPS_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const githubToken = process.env.GITHUB_TOKEN;
const configuredGitHubRepository = process.env.GITHUB_REPOSITORY;
const repository =
  configuredGitHubRepository ||
  process.env.RELEASE_REPOSITORY ||
  "sentinelops/payments-api";
const version = process.env.RELEASE_VERSION || "v1.0.0-dry-run";
const configuredCommitish = process.env.RELEASE_COMMIT_SHA;
const changeTicket = process.env.RELEASE_CHANGE_TICKET || "CHG-DRY-RUN-001";
const environment = process.env.RELEASE_ENVIRONMENT || "production";
const githubDryRun = readBoolean("GITHUB_DRY_RUN", true);
const githubReleaseMode = process.env.GITHUB_RELEASE_MODE || "draft";
const pollIntervalMs = readPositiveInteger(
  "SENTINELOPS_POLL_INTERVAL_MS",
  2_000,
);
const approvalTimeoutMs = readPositiveInteger(
  "SENTINELOPS_APPROVAL_TIMEOUT_MS",
  10 * 60 * 1_000,
);
const stepDelayMs = readPositiveInteger("DRY_RUN_STEP_DELAY_MS", 450);

if (!apiKey) {
  throw new Error(
    "SENTINELOPS_AGENT_API_KEY is required. Export the complete sop_live_ key before running this demo.",
  );
}

if (!["development", "staging", "production"].includes(environment)) {
  throw new Error(
    "RELEASE_ENVIRONMENT must be development, staging, or production.",
  );
}

if (Boolean(githubToken) !== Boolean(configuredGitHubRepository)) {
  throw new Error(
    "GITHUB_TOKEN and GITHUB_REPOSITORY must either both be configured or both be omitted.",
  );
}

if (githubReleaseMode !== "draft") {
  throw new Error("GITHUB_RELEASE_MODE must remain draft for the MVP.");
}

const githubClient =
  githubToken && configuredGitHubRepository
    ? createGitHubReleaseClient({
        token: githubToken,
        repository: configuredGitHubRepository,
      })
    : null;

function readPositiveInteger(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `SentinelOps returned a non-JSON response (${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `SentinelOps request failed (${response.status}): ${
        body.error || JSON.stringify(body)
      }`,
    );
  }

  return body;
}

function printDecision(decision) {
  console.log(`Request ID: ${decision.requestId}`);
  console.log(`Risk:       ${decision.risk}`);
  console.log(`Status:     ${decision.status}`);
  console.log(`Reason:     ${decision.reason}`);
}

async function waitForDecision(requestId) {
  const startedAt = Date.now();
  let pollCount = 0;

  console.log("");
  console.log("Human approval required.");
  console.log(`Open ${baseUrl}/dashboard and approve or deny the request.`);
  console.log("The release agent will wait and will not execute while pending.");

  while (Date.now() - startedAt < approvalTimeoutMs) {
    await sleep(pollIntervalMs);
    pollCount += 1;
    const decision = await requestJson(`/api/v1/actions/${requestId}`);

    if (decision.status !== "pending") {
      console.log("");
      console.log(`Decision received after ${pollCount} poll(s).`);
      return decision;
    }

    if (pollCount === 1 || pollCount % 5 === 0) {
      console.log(`Still pending (${pollCount} poll${pollCount === 1 ? "" : "s"})...`);
    }
  }

  throw new Error(
    `Approval timed out after ${Math.round(approvalTimeoutMs / 1_000)} seconds. No release was performed.`,
  );
}

async function simulateRelease(commitish) {
  const steps = [
    `Verify release target ${commitish}`,
    `Build release artifact for ${repository}`,
    `Create GitHub release ${version}`,
    `Attach deployment evidence for ${changeTicket}`,
  ];

  console.log("");
  console.log("DRY RUN: approval permits execution.");

  for (const [index, step] of steps.entries()) {
    await sleep(stepDelayMs);
    console.log(`[${index + 1}/${steps.length}] ${step}`);
  }

  console.log("");
  console.log("Dry run completed successfully.");
  console.log("No GitHub write API was called and no external system was changed.");

  return {
    summary: `GitHub release ${version} dry run completed successfully.`,
    externalReference: `dry-run://${repository}/${version}`,
  };
}

async function executeRelease(commitish) {
  if (!githubClient || githubDryRun) return simulateRelease(commitish);

  console.log("");
  console.log("Creating an approved GitHub draft release...");
  const release = await githubClient.createDraftRelease({
    tagName: version,
    targetCommitish: commitish,
    name: `${version} — SentinelOps governed release`,
    body: `Approved by SentinelOps under change ticket ${changeTicket}.`,
  });
  console.log(
    release.replayed
      ? "Existing GitHub draft release found; no duplicate was created."
      : "GitHub draft release created.",
  );
  console.log(`Draft URL: ${release.htmlUrl}`);

  return {
    summary: release.replayed
      ? `Existing GitHub draft release ${version} verified.`
      : `GitHub draft release ${version} created successfully.`,
    externalReference: release.htmlUrl,
  };
}

async function reportOutcome(requestId, outcome) {
  const result = await requestJson(
    `/api/v1/actions/${requestId}/outcome`,
    {
      method: "POST",
      body: JSON.stringify(outcome),
    },
  );
  console.log(`SentinelOps execution status: ${result.execution.status}`);
  return result;
}

async function main() {
  let repositoryInfo = null;
  if (githubClient) {
    console.log("Validating restricted GitHub repository access...");
    repositoryInfo = await githubClient.validateRepository();
    console.log(`GitHub repository verified: ${repositoryInfo.fullName}`);
    console.log(
      `GitHub mode: ${githubDryRun ? "read-only dry run" : "draft release"}`,
    );
    console.log("");
  }
  const commitish = configuredCommitish || repositoryInfo?.defaultBranch || "main";
  const idempotencyKey =
    process.env.SENTINELOPS_IDEMPOTENCY_KEY ||
    `dry-run-release-${repository}-${version}-${Date.now()}`;

  console.log("SentinelOps Release Agent");
  console.log("-------------------------");
  console.log(`Repository:  ${repository}`);
  console.log(`Version:     ${version}`);
  console.log(`Target:      ${commitish}`);
  console.log(`Environment: ${environment}`);
  console.log(`Change:      ${changeTicket}`);
  console.log("");
  console.log("Requesting authorization before execution...");

  let decision = await requestJson("/api/v1/actions/evaluate", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey,
      agent: {
        externalId: "dry-run-release-agent",
        name: "Dry-run Release Agent",
        ownerEmail: "platform@example.com",
        team: "Platform Engineering",
        provider: "SentinelOps Demo",
      },
      action: "deploy.release",
      resource: `${repository}@${version}`,
      environment,
      context: {
        commitSha: commitish,
        changeTicket,
        dryRun: githubDryRun,
        releaseMode: githubReleaseMode,
      },
    }),
  });

  printDecision(decision);

  if (decision.status === "pending") {
    decision = await waitForDecision(decision.requestId);
    printDecision(decision);
  }

  if (decision.status === "allowed" || decision.status === "approved") {
    const initialReference =
      repositoryInfo?.htmlUrl || `dry-run://${repository}/${version}`;
    await reportOutcome(decision.requestId, {
      status: "executing",
      summary: `Started ${githubDryRun ? "dry-run" : "draft"} release ${version}.`,
      externalReference: initialReference,
    });

    try {
      const result = await executeRelease(commitish);
      await reportOutcome(decision.requestId, {
        status: "succeeded",
        summary: result.summary,
        externalReference: result.externalReference,
      });
    } catch (error) {
      await reportOutcome(decision.requestId, {
        status: "failed",
        summary:
          error instanceof Error
            ? `GitHub release workflow failed: ${error.message}`
            : "GitHub release workflow failed unexpectedly.",
        errorCode: githubDryRun ? "DRY_RUN_FAILED" : "GITHUB_RELEASE_FAILED",
        externalReference: initialReference,
      }).catch((reportError) => {
        console.error(
          "SentinelOps could not record the failed execution outcome:",
          reportError,
        );
      });
      throw error;
    }
    return;
  }

  console.log("");
  console.error(
    `Dry run stopped because SentinelOps returned "${decision.status}".`,
  );
  console.error("No GitHub release was created.");
  process.exitCode = decision.status === "blocked" ? 3 : 2;
}

main().catch((error) => {
  console.error("");
  console.error(
    error instanceof Error ? error.message : "Unexpected dry-run failure.",
  );
  console.error("No GitHub release was created by this failed run.");
  process.exitCode = 1;
});
