import process from "node:process";

const apiKey = process.env.SENTINELOPS_AGENT_API_KEY;
const baseUrl = (process.env.SENTINELOPS_URL || "http://localhost:3000").replace(/\/$/, "");
const repository = process.env.RELEASE_REPOSITORY || "sentinelops/payments-api";
const version = process.env.RELEASE_VERSION || "v1.0.0-dry-run";
const commitish = process.env.RELEASE_COMMIT_SHA || "main";
const changeTicket = process.env.RELEASE_CHANGE_TICKET || "CHG-DRY-RUN-001";
const environment = process.env.RELEASE_ENVIRONMENT || "production";
const pollIntervalMs = readPositiveInteger("SENTINELOPS_POLL_INTERVAL_MS", 2_000);
const timeoutMs = readPositiveInteger("SENTINELOPS_APPROVAL_TIMEOUT_MS", 10 * 60 * 1_000);

if (!apiKey) {
  throw new Error(
    "SENTINELOPS_AGENT_API_KEY is required. Export the complete sop_live_ key before running this demo.",
  );
}
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error("RELEASE_REPOSITORY must use the owner/repository format.");
}
if (!["development", "staging", "production"].includes(environment)) {
  throw new Error("RELEASE_ENVIRONMENT must be development, staging, or production.");
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
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `SentinelOps request failed (${response.status}): ${body.error || JSON.stringify(body)}`,
    );
  }
  return body;
}

function printState(decision) {
  console.log(`Decision:  ${decision.status}`);
  console.log(`Execution: ${decision.execution.status}`);
  console.log(`Reason:    ${decision.reason}`);
}

async function waitForCompletion(requestId) {
  const startedAt = Date.now();
  let lastState = "";
  while (Date.now() - startedAt < timeoutMs) {
    const decision = await requestJson(`/api/v1/actions/${requestId}`);
    const state = `${decision.status}:${decision.execution.status}`;
    if (state !== lastState) {
      console.log("");
      printState(decision);
      lastState = state;
    }
    if (["denied", "blocked"].includes(decision.status)) return decision;
    if (["succeeded", "failed"].includes(decision.execution.status)) return decision;
    await sleep(pollIntervalMs);
  }
  throw new Error("Timed out while waiting for approval and automated execution.");
}

async function main() {
  console.log("SentinelOps governed release demo");
  console.log("---------------------------------");
  console.log(`Repository:  ${repository}`);
  console.log(`Version:     ${version}`);
  console.log(`Target:      ${commitish}`);
  console.log(`Environment: ${environment}`);
  console.log(`Change:      ${changeTicket}`);

  const decision = await requestJson("/api/v1/actions/evaluate", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey:
        process.env.SENTINELOPS_IDEMPOTENCY_KEY ||
        `governed-release-${repository}-${version}-${Date.now()}`,
      agent: {
        externalId: "governed-release-agent",
        name: "Governed Release Agent",
        ownerEmail: "platform@example.com",
        team: "Platform Engineering",
        provider: "SentinelOps Demo",
      },
      action: "deploy.release",
      resource: `${repository}@${version}`,
      environment,
      context: { commitSha: commitish, changeTicket },
    }),
  });

  console.log(`Request ID:  ${decision.requestId}`);
  printState(decision);
  if (decision.status === "pending") {
    console.log("");
    console.log(`Approve or deny the request at ${baseUrl}/dashboard.`);
  }

  const completed = await waitForCompletion(decision.requestId);
  if (completed.execution.status === "succeeded") {
    console.log("");
    console.log(completed.execution.summary);
    if (completed.execution.externalReference) {
      console.log(`Evidence: ${completed.execution.externalReference}`);
    }
    return;
  }

  const reason = completed.execution.summary || completed.reason;
  throw new Error(`Release did not complete: ${reason}`);
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : "Unexpected release failure.");
  process.exitCode = 1;
});
