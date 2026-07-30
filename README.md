# SentinelOps

SentinelOps is an enforcement gateway for consequential AI-agent actions. The
first real vertical slice supports:

- tenant-scoped agent API keys;
- idempotent action evaluation;
- deterministic allow, approval, and block decisions;
- a human approval queue;
- PostgreSQL persistence;
- hash-chained audit evidence;
- optional Slack approval notifications; and
- a control center that can switch between preview and live data.

## Stack

The project follows the same foundation as `mtb-trail-finder`: Next.js 16 App
Router, React 19, TypeScript 5.9, Tailwind CSS 3, PostgreSQL, Zod, Vitest,
ESLint, Lucide, and pnpm.

## Start locally

1. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

2. Generate a strong operator token and place it in
   `SENTINELOPS_ADMIN_TOKEN`:

   ```bash
   openssl rand -base64 36
   ```

3. Start PostgreSQL. If Docker is available:

   ```bash
   docker compose up -d postgres
   ```

4. Install dependencies, migrate, and seed:

   ```bash
   pnpm install
   pnpm db:migrate
   pnpm db:seed
   ```

   The seed command prints an agent API key once. Store it securely.

5. Start the application:

   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) for the landing page and
[http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the
control center. Select **Connect live** and enter the operator token.

## Evaluate an agent action

```bash
curl --request POST http://localhost:3000/api/v1/actions/evaluate \
  --header "Authorization: Bearer $SENTINELOPS_AGENT_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "idempotencyKey": "release-2026-07-29-v1",
    "agent": {
      "externalId": "github-release-agent",
      "name": "GitHub Release Agent",
      "ownerEmail": "platform@example.com",
      "team": "Platform Engineering",
      "provider": "OpenAI"
    },
    "action": "deploy.release",
    "resource": "sentinelops/platform@v1.0.0",
    "environment": "production",
    "context": {
      "commitSha": "abc123",
      "changeTicket": "CHG-1042"
    }
  }'
```

A production deployment returns `status: "pending"`. Approve or deny it in the
control center, then poll:

```bash
curl http://localhost:3000/api/v1/actions/REQUEST_ID \
  --header "Authorization: Bearer $SENTINELOPS_AGENT_API_KEY"
```

The agent must not execute while the status is `pending`, `blocked`, or
`denied`. It may execute only for `allowed` or `approved`.

## Run the safe release-agent demo

The included Release Agent demonstrates the complete enforcement loop without
calling GitHub or changing an external system.

Add the complete agent key printed by `pnpm db:seed` to `.env.local`:

```bash
SENTINELOPS_AGENT_API_KEY=sop_live_your_complete_key
```

Keep SentinelOps running with `pnpm dev`, then open a second terminal:

```bash
pnpm demo:release
```

The demo submits a production release and waits while the decision is
`pending`. Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard),
connect the live workspace, and approve or deny the request.

After approval, the agent simulates four release steps. After denial or a
policy block, it stops without executing. It never reads a GitHub token and
never calls the GitHub API.

Optional `.env.local` values let you customize the demonstration:

```bash
RELEASE_REPOSITORY=sentinelops/payments-api
RELEASE_VERSION=v1.0.0-dry-run
RELEASE_COMMIT_SHA=abc123dryrun
RELEASE_CHANGE_TICKET=CHG-DRY-RUN-001
RELEASE_ENVIRONMENT=production
```

## Recorded product walkthrough

The repository includes a 22-second local walkthrough of the governed release
flow:

[Watch the SentinelOps product demo](public/demos/sentinelops-product-demo.webm)

It shows the product introduction, a production release entering the live
approval queue, operator approval, the resulting audit evidence, and the safe
dry-run completion state. No production credentials or external systems are
used in the recording.

## API behavior

- `POST /api/v1/actions/evaluate` authenticates an agent API key, upserts the
  agent, evaluates ordered policies, records the request, and returns the
  enforcement decision.
- `GET /api/v1/actions/:requestId` lets the originating organization poll the
  decision.
- `POST /api/v1/actions/:requestId/decision` requires an authenticated operator
  session and records an atomic approval or denial.
- `PATCH /api/v1/policies/:policyId` updates enforcement state and records audit
  evidence.
- `GET /api/v1/control-center` returns live operator data.

## Security boundaries

- Agent API keys are stored as SHA-256 hashes, never plaintext.
- Operator tokens become eight-hour HttpOnly, same-site sessions.
- Requests are tenant-scoped and idempotent.
- Pending decisions use conditional updates to prevent double approval.
- Audit events form an organization-level SHA-256 hash chain.
- PostgreSQL queries are parameterized and use a bounded connection pool.
- Slack is disabled unless `SLACK_APPROVAL_WEBHOOK_URL` is configured.

This MVP is not yet a complete enterprise security product. SSO, SCIM,
fine-grained operator roles, key rotation UI, webhook signing, audit export,
retention controls, and formal compliance work remain later milestones.
