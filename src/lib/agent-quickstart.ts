export type QuickstartLanguage = "curl" | "node" | "python";

export const quickstartLanguages: Array<{
  id: QuickstartLanguage;
  label: string;
}> = [
  { id: "curl", label: "cURL" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
];

const examplePayload = {
  idempotencyKey: "invoice-review-001",
  agent: {
    externalId: "invoice-review-agent",
    name: "Invoice Review Agent",
    ownerEmail: "finance-platform@example.com",
    team: "Finance Platform",
    provider: "OpenAI",
  },
  action: "invoice.payment.prepare",
  resource: "invoice/INV-1042",
  environment: "development",
  context: {
    amount: 4250,
    currency: "USD",
  },
};

const payloadJson = JSON.stringify(examplePayload, null, 2);

export function getQuickstartSnippet(language: QuickstartLanguage) {
  if (language === "node") {
    return `const response = await fetch(
  \`\${process.env.SENTINELOPS_BASE_URL}/api/v1/actions/evaluate\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.SENTINELOPS_AGENT_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(${payloadJson}),
  },
);

const decision = await response.json();
if (!response.ok) throw new Error(decision.error);
console.log(decision.status, decision.requestId);`;
  }

  if (language === "python") {
    return `import json
import os
import urllib.request

payload = ${payloadJson
  .replaceAll("true", "True")
  .replaceAll("false", "False")
  .replaceAll("null", "None")}

request = urllib.request.Request(
    f"{os.environ['SENTINELOPS_BASE_URL']}/api/v1/actions/evaluate",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {os.environ['SENTINELOPS_AGENT_API_KEY']}",
        "Content-Type": "application/json",
    },
    method="POST",
)

with urllib.request.urlopen(request) as response:
    decision = json.load(response)
    print(decision["status"], decision["requestId"])`;
  }

  const compactPayload = JSON.stringify(examplePayload);
  return `curl --request POST \\
  "$SENTINELOPS_BASE_URL/api/v1/actions/evaluate" \\
  --header "Authorization: Bearer $SENTINELOPS_AGENT_API_KEY" \\
  --header "Content-Type: application/json" \\
  --data '${compactPayload}'`;
}

