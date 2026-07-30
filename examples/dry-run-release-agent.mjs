import process from "node:process";

const apiKey = process.env.SENTINELOPS_AGENT_API_KEY;
const baseUrl = (process.env.SENTINELOPS_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const repository =
  process.env.RELEASE_REPOSITORY || "sentinelops/payments-api";
const version = process.env.RELEASE_VERSION || "v1.0.0-dry-run";
const commitSha = process.env.RELEASE_COMMIT_SHA || "abc123dryrun";
const changeTicket = process.env.RELEASE_CHANGE_TICKET || "CHG-DRY-RUN-001";
const environment = process.env.RELEASE_ENVIRONMENT || "production";
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

function readPositiveInteger(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
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

async function simulateRelease() {
  const steps = [
    `Verify commit ${commitSha}`,
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
  console.log("No GitHub API was called and no external system was changed.");
}

async function main() {
  const idempotencyKey =
    process.env.SENTINELOPS_IDEMPOTENCY_KEY ||
    `dry-run-release-${repository}-${version}-${Date.now()}`;

  console.log("SentinelOps Release Agent");
  console.log("-------------------------");
  console.log(`Repository:  ${repository}`);
  console.log(`Version:     ${version}`);
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
        commitSha,
        changeTicket,
        dryRun: true,
      },
    }),
  });

  printDecision(decision);

  if (decision.status === "pending") {
    decision = await waitForDecision(decision.requestId);
    printDecision(decision);
  }

  if (decision.status === "allowed" || decision.status === "approved") {
    await simulateRelease();
    return;
  }

  console.log("");
  console.error(
    `Dry run stopped because SentinelOps returned "${decision.status}".`,
  );
  console.error("No GitHub API was called and no external system was changed.");
  process.exitCode = decision.status === "blocked" ? 3 : 2;
}

main().catch((error) => {
  console.error("");
  console.error(
    error instanceof Error ? error.message : "Unexpected dry-run failure.",
  );
  console.error("No GitHub API was called and no external system was changed.");
  process.exitCode = 1;
});
