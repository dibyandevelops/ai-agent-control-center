const apiKey = process.env.SENTINELOPS_AGENT_API_KEY;
if (!apiKey) {
  throw new Error("SENTINELOPS_AGENT_API_KEY is required.");
}

const baseUrl = process.env.SENTINELOPS_URL || "http://localhost:3000";
const response = await fetch(`${baseUrl}/api/v1/actions/evaluate`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    idempotencyKey: `example-release-${Date.now()}`,
    agent: {
      externalId: "github-release-agent",
      name: "GitHub Release Agent",
      ownerEmail: "platform@example.com",
      team: "Platform Engineering",
      provider: "OpenAI",
    },
    action: "deploy.release",
    resource: "sentinelops/platform@v1.0.0",
    environment: "production",
    context: {
      commitSha: "abc123",
      changeTicket: "CHG-1042",
    },
  }),
});

const result = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok) process.exitCode = 1;
