# SentinelOps

SentinelOps is an enforcement gateway for consequential AI-agent actions. The
first real vertical slice supports:

- tenant-scoped agent API keys;
- idempotent action evaluation;
- deterministic allow, approval, and block decisions;
- a human approval queue;
- database-backed operator accounts with role-based access;
- PostgreSQL persistence;
- hash-chained audit evidence;
- agent-reported execution outcomes;
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

2. Start PostgreSQL. If Docker is available:

   ```bash
   docker compose up -d postgres
   ```

3. Install dependencies, migrate, and seed:

   ```bash
   pnpm install
   pnpm db:migrate
   pnpm db:seed
   ```

   The seed command prints an agent API key once. Store it securely.

4. Set `SENTINELOPS_OPERATOR_EMAIL`, `SENTINELOPS_OPERATOR_NAME`, and a strong
   `SENTINELOPS_OPERATOR_PASSWORD` in `.env.local`, then create the first admin:

   ```bash
   pnpm operator:create
   ```

   The password is hashed with scrypt before it is stored. Running the command
   again updates the named account, so it can also reset a local password.

5. Start the application:

   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) for the landing page and
[http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the
control center. Select **Connect live** and sign in with the operator email and
password created above.

Operator roles are deliberately small for the MVP:

- `admin` can view data, decide actions, manage policies, and manage operators;
- `approver` can view data and approve or deny pending actions; and
- `auditor` has read-only access to operational and audit evidence.

Accounts created from **Team access** receive a temporary password. On first
login, SentinelOps blocks protected workspace requests until the operator
replaces it. Operators can later open their profile control to change the
password again.

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

After authorization, the agent reports its real execution lifecycle:

```bash
curl --request POST \
  http://localhost:3000/api/v1/actions/REQUEST_ID/outcome \
  --header "Authorization: Bearer $SENTINELOPS_AGENT_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "status": "executing",
    "summary": "Production deployment started.",
    "externalReference": "https://github.com/example/repository/actions/runs/123"
  }'
```

When the work finishes, call the same endpoint with `succeeded`, `failed`, or
`cancelled`. Failed outcomes may also include an `errorCode`. Completed
outcomes are terminal and cannot be rewritten.

## Run the safe release-agent demo

The included Release Agent demonstrates the complete enforcement loop without
calling GitHub or changing an external system.

Add the complete agent key printed by `pnpm db:seed` to `.env.local`:

```bash
SENTINELOPS_AGENT_API_KEY=sop_live_your_complete_key
```

For the GitHub sandbox integration, add a fine-grained token restricted to one
test repository with `Contents: Read and write`:

```bash
GITHUB_TOKEN=github_pat_your_complete_token
GITHUB_REPOSITORY=your-account/sentinelops-release-sandbox
GITHUB_RELEASE_MODE=draft
GITHUB_DRY_RUN=true
```

Verify access without changing GitHub:

```bash
pnpm github:verify
```

The verification command checks the exact repository, confirms it is not
archived, and confirms the token has write access. It never prints the token.

Keep SentinelOps running with `pnpm dev`, then open a second terminal:

```bash
pnpm demo:release
```

The demo submits a production release and waits while the decision is
`pending`. Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard),
connect the live workspace, and approve or deny the request.

With `GITHUB_DRY_RUN=true`, the agent validates the configured GitHub repository,
then reports `executing`, simulates four release steps, and reports `succeeded`.
No GitHub write API is called. After denial or a policy block, it stops without
executing.

Only after the dry run is verified should `GITHUB_DRY_RUN` be changed to
`false`. Even then, the client is hard-limited to creating a **draft** release
in `GITHUB_REPOSITORY`; it cannot publish the release. Existing draft tags are
treated as idempotent replays, while an existing published tag is rejected.

Optional `.env.local` values let you customize the demonstration:

```bash
RELEASE_VERSION=v1.0.0-dry-run
RELEASE_COMMIT_SHA=main
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
- `GET /api/v1/actions/:requestId/details` requires an authenticated operator
  session and returns the decision, execution state, agent ownership, policy,
  and ordered audit timeline for the dashboard evidence drawer.
- `POST /api/v1/actions/:requestId/decision` requires an authenticated operator
  with the `admin` or `approver` role and records an atomic approval or denial.
- `POST /api/v1/actions/:requestId/outcome` lets the originating organization
  report `executing`, `succeeded`, `failed`, or `cancelled` and records each
  transition as audit evidence.
- `GET /api/v1/audit/integrity` requires an authenticated operator session and
  recomputes every event hash and previous-hash link across organization audit
  chains. The Audit Log exposes this as **Verify integrity**.
- `PATCH /api/v1/policies/:policyId` requires an `admin`, updates enforcement
  state, and records audit evidence.
- `GET /api/v1/operators` and `POST /api/v1/operators` let an `admin` list and
  create organization-scoped operator accounts.
- `PATCH /api/v1/operators/:operatorId` lets an `admin` change another
  operator's role or account status, or clear a temporary login lock. Disabling
  an account immediately revokes its active sessions.
- `PATCH /api/v1/session/password` verifies the current password, replaces it,
  clears the first-login restriction, rotates the current session, and revokes
  every other active session for that operator.
- `GET /api/v1/control-center` returns organization-scoped live operator data.

## Security boundaries

- Agent API keys are stored as SHA-256 hashes, never plaintext.
- Operator passwords are stored as salted scrypt hashes.
- Successful login creates an opaque, revocable, eight-hour HttpOnly,
  same-site session; only its SHA-256 hash is stored.
- Temporary-password sessions cannot access protected operator APIs until the
  password is replaced.
- Password changes use a conditional database update and rotate all sessions,
  preventing concurrent changes from silently overwriting one another.
- Five failed password attempts within 15 minutes lock the account for 15
  minutes. Counter updates are atomic, locked attempts cannot extend the lock,
  and the transition is recorded in the audit chain.
- Administrators can clear a temporary lock from **Team access** after
  verifying the operator's identity through an appropriate support channel.
- Operator permissions are enforced server-side with `admin`, `approver`, and
  read-only `auditor` roles.
- Requests are tenant-scoped and idempotent.
- Pending decisions use conditional updates to prevent double approval.
- Execution outcomes use row locking and terminal-state protection to prevent
  concurrent or rewritten completion results.
- Audit events form an organization-level SHA-256 hash chain.
- PostgreSQL queries are parameterized and use a bounded connection pool.
- Slack is disabled unless `SLACK_APPROVAL_WEBHOOK_URL` is configured.

This MVP is not yet a complete enterprise security product. SSO, SCIM,
fine-grained operator roles, key rotation UI, webhook signing, audit export,
retention controls, and formal compliance work remain later milestones.
