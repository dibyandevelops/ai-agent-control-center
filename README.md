# SentinelOps

SentinelOps is an enforcement gateway for consequential AI-agent actions. The
first real vertical slice supports:

- tenant-scoped agent API keys;
- idempotent action evaluation;
- deterministic allow, approval, and block decisions;
- a human approval queue;
- immutable policy version history with four-eyes activation and rollback;
- database-backed operator accounts with role-based access;
- PostgreSQL persistence;
- hash-chained audit evidence;
- signed GitHub webhook reconciliation and release-drift incidents;
- agent-reported execution outcomes;
- durable Slack approval, failure, drift, and integration-security notifications; and
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

Run the complete isolated approval journey before a pilot or release:

```bash
pnpm test:e2e
```

The command migrates and builds the application, starts it on an available
local port, creates a temporary organization, and verifies action evaluation,
idempotent replay, durable notification creation, operator approval, execution
reporting, action details, and audit-chain integrity. It removes the temporary
organization and stops the server even when a check fails.

## Staging deployment

SentinelOps uses a separate staging project so testing cannot touch production.
Create a Neon database/branch dedicated to staging and a dedicated Vercel
project, then configure these Vercel production-scoped variables:

```text
DATABASE_URL=<Neon pooled staging connection string>
SENTINELOPS_PUBLIC_URL=https://your-staging-host.example
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_POOL_MAX=5
CRON_SECRET=<at least 32 random characters>
ACTION_APPROVAL_TTL_MINUTES=1440
POLICY_ACTIVATION_TTL_HOURS=24
POLICY_ACTIVATION_REMINDER_MINUTES=240
SLACK_APPROVAL_WEBHOOK_URL=<optional staging-only webhook>
SLACK_CLIENT_ID=<Slack app client ID>
SLACK_CLIENT_SECRET=<Slack app client secret>
SLACK_CREDENTIAL_ENCRYPTION_KEY=<base64-encoded 32-byte key>
```

`CRON_SECRET` can be generated with `openssl rand -hex 32`. Vercel uses it to
authenticate the two scheduled routes declared in `vercel.json`. Preview and
production databases must never share the same connection string. The Hobby
staging project runs each worker once per day because that plan does not permit
more frequent cron jobs. Before a pilot, use a plan that supports a one-minute
outbox and five-minute reminder schedule, or configure an external scheduler to
call the same authenticated routes.

`ACTION_APPROVAL_TTL_MINUTES` controls how long a consequential action remains
available for human review. Local development defaults to 30 minutes; staging
uses 1,440 minutes so a manual demonstration remains available for one day.

Create a GitHub environment named `staging` and add four environment secrets:

- `STAGING_DATABASE_URL` — the same isolated Neon staging database;
- `VERCEL_TOKEN` — a Vercel account or team deployment token;
- `VERCEL_ORG_ID` — the team ID from the staging project link; and
- `VERCEL_PROJECT_ID` — the dedicated staging project ID.

The **Deploy staging** GitHub workflow is manual. It runs the isolated
enterprise journey against staging, builds a Vercel artifact, deploys that exact
artifact to the staging project, and requires `/api/health` to report a reachable
database. The normal **Quality gate** workflow runs on every pull request and
push to `main` using an isolated PostgreSQL service with no deployment secrets.

After the first staging deployment, point a temporary local environment at the
staging database and run `pnpm db:seed` and `pnpm operator:create` once to create
the persistent pilot organization and first administrator. Never run the seed
command in CI because it prints the newly generated agent key once.

### Current staging demo

Open [https://sentinelops-staging.vercel.app/dashboard](https://sentinelops-staging.vercel.app/dashboard)
and sign in as `admin@sentinelops.local`. The randomly generated password and
agent credential are stored in the local macOS Keychain rather than source
files. Retrieve them only when needed:

```bash
security find-generic-password \
  -a admin@sentinelops.local \
  -s sentinelops-staging-admin \
  -w

security find-generic-password \
  -a aperture-labs \
  -s sentinelops-staging-agent-api-key \
  -w
```

These commands print secrets to the terminal, so do not paste their output into
issues, chat, screenshots, or shell history. The staging tenant includes three
baseline policies and a pending production-release request for the first manual
approval demonstration.

Policy activation reviews expire after 24 hours and receive a reminder every
four hours by default. Override those windows with
`POLICY_ACTIVATION_TTL_HOURS` and `POLICY_ACTIVATION_REMINDER_MINUTES`. For
scheduled reminders, generate a private `SENTINELOPS_CRON_SECRET` with a secret
manager or `openssl rand -hex 32`, then have your
server scheduler call the dispatcher every five minutes:

```bash
curl --fail --request POST \
  --header "Authorization: Bearer $SENTINELOPS_CRON_SECRET" \
  http://localhost:3000/api/v1/internal/policy-activation-reminders

curl --fail --request POST \
  --header "Authorization: Bearer $SENTINELOPS_CRON_SECRET" \
  http://localhost:3000/api/v1/internal/notification-outbox

curl --fail --request POST \
  --header "Authorization: Bearer $SENTINELOPS_CRON_SECRET" \
  http://localhost:3000/api/v1/internal/release-execution
```

The dispatcher is disabled when the secret is absent. It marks overdue reviews
expired, queues a reminder on the first due interval, and escalates subsequent
due intervals. Newly queued notifications trigger the authenticated outbox
worker after the originating API response, so Slack alerts normally arrive in
near real time without adding delivery latency to the request. The scheduled
route remains the recovery path if that immediate trigger fails. The outbox
worker claims up to 50 notifications without blocking other workers, performs
Slack delivery after committing the claim, and retries failures with
exponential backoff. After five failed attempts, the notification is retained
in a dead-letter state for investigation. Slack delivery prefers an
organization-scoped OAuth connection. Webhook URLs are encrypted with
AES-256-GCM and never returned by the API. `SLACK_APPROVAL_WEBHOOK_URL` remains
only as a migration fallback for organizations that have not completed OAuth.

Approved `deploy.release` and `github.release.create` requests are claimed by
the automated release worker immediately after the approval response. Claims
use PostgreSQL row locks and worker leases, so concurrent invocations cannot
execute the same release twice. The notification-outbox schedule also runs the
worker as daily recovery for an interrupted lease; the dedicated internal route
above can be invoked for immediate operator recovery.

`RELEASE_EXECUTION_MODE=dry_run` is the safe default and records execution
evidence without calling a GitHub write API. Use `github_draft` only after
configuring the GitHub App and connecting an installation from **Integrations**.
The worker accepts only repositories synchronized for the request's
organization, mints a short-lived installation token when work begins, and
never stores that token. GitHub releases remain drafts. Set the mode to
`disabled` to retain the manual agent-reported outcome flow.

Draft creation approval never authorizes publication. After a GitHub draft is
created, an administrator must open its **Action evidence**, enter a reason,
and request either publication or cancellation. SentinelOps records a separate
governance request. A different administrator must approve it before the
release-governance worker can call GitHub. The database rejects maker/checker
identity reuse, allows only one active operation per draft, and records request,
review, worker, and terminal evidence in the original audit timeline.

Operator roles are deliberately small for the MVP:

- `admin` can view data, decide actions, manage policies, manage agent API
  keys, and manage operators;
- `approver` can view data and approve or deny pending actions; and
- `auditor` has read-only access to operational and audit evidence.

Accounts created from **Team access** receive a temporary password. On first
login, SentinelOps blocks protected workspace requests until the operator
replaces it. Operators can later open their profile control to change the
password again.

Administrators can create agent credentials from **Credentials**. SentinelOps
shows the complete key only after creation or rotation, so copy it directly to
the workload's secret manager before closing the dialog. Rotation revokes the
previous credential atomically; revocation takes effect on the next request.
The same screen includes copyable cURL, dependency-free Node.js, and
standard-library Python examples. After creating or rotating a key, **Test
connection** sends a harmless development health-read through the real policy
engine without persisting the plaintext credential in browser storage.

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

Create a GitHub App for SentinelOps with:

- Repository permission **Contents: Read and write**;
- webhook events **Releases**, **Installation**, and **Installation repositories**;
- webhook URL `https://your-sentinelops-host/api/v1/webhooks/github`; and
- a private key generated from the GitHub App settings page.

Add the App identity and webhook secret to `.env.local` (use escaped newlines
when entering the private key in Vercel):

```bash
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-sentinelops-app-slug
GITHUB_APP_CLIENT_ID=Iv1.your_client_id
GITHUB_APP_CLIENT_SECRET=your_client_secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=replace-with-openssl-rand-hex-32
RELEASE_EXECUTION_MODE=dry_run
```

Enable **Request user authorization (OAuth) during installation** and set the
callback URL to
`https://your-sentinelops-host/api/v1/github/installations/callback`. Then open
**Integrations → GitHub** and choose **Install or connect GitHub App**. GitHub
verifies that the signed-in installer can access the installation before
SentinelOps links its repositories. A GitHub installation can belong to only
one SentinelOps organization.

SentinelOps does not accept a global GitHub personal access token. Repository
credentials are short-lived installation tokens created only after the repository
has been connected to the current SentinelOps organization.

Keep SentinelOps running with `pnpm dev`, then open a second terminal:

```bash
pnpm demo:release
```

The demo submits a production release and waits while the decision is
`pending`. Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard),
connect the live workspace, and approve or deny the request.

With `RELEASE_EXECUTION_MODE=dry_run`, SentinelOps automatically simulates the
approved release and records evidence without calling GitHub. After the full
approval journey is verified, set `RELEASE_EXECUTION_MODE=github_draft`.
SentinelOps then obtains a short-lived token for the organization's GitHub App
installation and creates only a **draft** release in the repository named by the
request. Publishing or cancelling that draft requires a separate four-eyes
approval. Existing draft tags are treated as idempotent replays, while an
existing published tag is rejected.

### Detect GitHub changes outside SentinelOps

Generate a webhook secret without committing it:

```bash
openssl rand -hex 32
```

On the SentinelOps GitHub App, configure:

- Payload URL: `https://your-sentinelops-host/api/v1/webhooks/github`
- Content type: `application/json`
- Secret: the same value as `GITHUB_WEBHOOK_SECRET`
- Events: select **Releases**. GitHub sends the mandatory **Installation** and
  **Installation repositories** events to GitHub Apps automatically.

The endpoint verifies `X-Hub-Signature-256` against the unmodified request body
and deduplicates `X-GitHub-Delivery`. Release creation, publication, and
cancellation are accepted only when matching SentinelOps evidence exists.
Direct publishing, editing, deletion, or unpublishing creates a visible
incident, queues a Slack alert, and appends tamper-evident audit events. An
administrator can acknowledge the incident with an investigation note from the
Integrations screen. Critical incidents freeze publish and cancel automation
for the affected repository and tag. Acknowledgment does not lift that freeze;
an administrator must record a remediation note and explicitly resolve the
incident. Resolution removes containment and resumes any already-approved
operation that was waiting behind it.

The same signed endpoint immediately applies GitHub App lifecycle changes.
Suspended installations stop issuing repository credentials, deleted
installations are retained as disconnected audit evidence, and repositories
removed from an installation are disabled for that SentinelOps organization.
Delivery IDs make these updates safe when GitHub retries a webhook. Suspension,
deletion, and repository removal also create high-priority, deduplicated Slack
alerts through the durable outbox. Each alert links directly to
`/dashboard?view=integrations` on `SENTINELOPS_PUBLIC_URL` for remediation.

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
- `POST /api/v1/actions/:requestId/draft-governance` lets an administrator
  request publication or cancellation of a successfully created GitHub draft.
- `POST /api/v1/release-governance/:governanceId/decision` requires a different
  administrator and starts the approved GitHub operation asynchronously.
- `POST /api/v1/release-governance/:governanceId/retry` requires an
  administrator and requeues only failed operations that already received an
  independent approval. It cannot manufacture or replace approval evidence.
- The live **Approvals** view includes a separate release-governance queue with
  deadline countdowns, urgency and escalation indicators, full evidence links,
  independent review controls, and recovery for failed GitHub operations.
- `POST /api/v1/webhooks/github` verifies and deduplicates signed GitHub
  `release`, `installation`, and `installation_repositories` deliveries. It
  reconciles release mutations with SentinelOps evidence and immediately
  enforces installation suspension, deletion, and repository access changes.
- `GET/POST /api/v1/github/connections` lists or connects GitHub App
  installations only for the signed-in administrator's organization.
- `POST /api/v1/github/connections/:connectionId/sync` refreshes the authorized
  repository list and disables repositories removed from the installation.
- `POST /api/v1/github-drift/:incidentId/acknowledge` requires an administrator,
  preserves the investigation note in the audit chain, and keeps critical
  release containment active.
- `POST /api/v1/github-drift/:incidentId/resolve` requires an acknowledged
  incident and an administrator remediation note, records containment release
  in the audit chain, and resumes matching approved operations.
- `POST /api/v1/actions/:requestId/outcome` lets the originating organization
  report `executing`, `succeeded`, `failed`, or `cancelled` and records each
  transition as audit evidence.
- `GET /api/v1/audit/integrity` requires an authenticated operator session and
  recomputes every event hash and previous-hash link across organization audit
  chains. The Audit Log exposes this as **Verify integrity**.
- `POST /api/v1/policies` requires an `admin`, validates a guided set of
  conditions, and creates an organization-scoped policy with an immutable
  version-one snapshot. Requesting activation creates a pending review; it does
  not make the policy live immediately.
- `PATCH /api/v1/policies/:policyId` requires an `admin`. Configuration changes
  create a new immutable version while the currently approved version continues
  to enforce. An active policy can still be disabled immediately as a safe
  shutdown action.
- `GET /api/v1/policies/:policyId/versions` returns the organization-scoped
  version timeline, activation state, requester, reviewer, and review reason.
- `POST /api/v1/policies/activation-requests/:requestId/decision` requires a
  review note from a second `admin`. The requesting administrator is prevented
  from approving or rejecting their own activation request. The review screen
  shows an active-versus-proposed field diff and a point-in-time replay of up to
  50 recent actions captured when the request was created.
- `POST /api/v1/policies/:policyId/rollback` creates a new version from the
  selected historical snapshot and sends that version through the same
  independent activation review; history is never rewritten.
- `GET` or `POST /api/v1/internal/policy-activation-reminders` requires the
  cron bearer secret. It processes bounded reminder batches using row locks
  with `SKIP LOCKED`, expires overdue requests, and atomically writes
  deduplicated notification-outbox records.
- `GET` or `POST /api/v1/internal/notification-outbox` requires the same cron
  bearer secret. It reclaims stale worker leases, delivers due notifications in
  bounded batches, schedules exponential retries, and dead-letters terminal
  failures without losing their payload or audit history. Successful outbox
  inserts also schedule this worker immediately after the API response; the
  cron invocation is durable recovery rather than the normal delivery path.
  This includes GitHub App lifecycle alerts for suspension, disconnection, and
  repository removal.
- `POST /api/v1/notifications/retry-dead` requires an administrator. It returns
  up to 100 failed notifications to the delivery queue and records each manual
  recovery in the audit chain. The same recovery control appears on the live
  Slack integration card whenever failed notifications exist.
- `POST /api/v1/policies/simulate` requires an `admin` and replays up to 50
  recent organization actions through an unsaved draft and the current enabled
  policy order. It reports matches, cases where the draft wins, and decisions
  that would change without saving, activating, or enforcing the draft.
- `GET /api/v1/api-keys` lets an `admin` list safe credential metadata without
  exposing plaintext keys or stored hashes.
- `POST /api/v1/api-keys` creates an organization-scoped agent credential and
  returns its plaintext once with no-store response headers.
- `POST /api/v1/api-keys/:keyId/rotate` atomically revokes the selected key,
  creates its replacement, and returns the new plaintext once.
- `DELETE /api/v1/api-keys/:keyId` immediately revokes an active credential.
  Creation, rotation, and revocation are recorded in the audit chain.
- `GET /api/v1/operators` and `POST /api/v1/operators` let an `admin` list and
  create organization-scoped operator accounts.
- `PATCH /api/v1/operators/:operatorId` lets an `admin` change another
  operator's role or account status, or clear a temporary login lock. Disabling
  an account immediately revokes its active sessions.
- `POST /api/v1/operators/:operatorId/password-reset` generates a one-time
  temporary password for another operator, revokes all of their sessions,
  clears any login lock, and forces password replacement at next login. The
  temporary credential is returned once with no-store response headers.
- `PATCH /api/v1/session/password` verifies the current password, replaces it,
  clears the first-login restriction, rotates the current session, and revokes
  every other active session for that operator.
- `GET /api/v1/control-center` returns organization-scoped live operator data.

## Security boundaries

- Agent API keys use 256 bits of server-generated randomness and are stored as
  SHA-256 hashes, never plaintext. Lists expose only a short non-sensitive
  prefix; create and rotate responses are explicitly non-cacheable.
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
- Administrator password resets use 192 bits of server-generated randomness.
  Only the scrypt hash is stored; the plaintext credential is shown once and
  is deliberately excluded from audit payloads.
- Operator permissions are enforced server-side with `admin`, `approver`, and
  read-only `auditor` roles.
- Policy activation uses maker-checker governance: only an independent
  administrator can approve or reject a requested version, and the database
  prevents multiple pending activations for the same policy.
- Policy edits and rollback requests never replace the active rule before
  approval. Every evaluated action records the exact active policy version used
  for its decision.
- Activation requests persist their historical simulation summary and changed
  examples, so later reviewers see the evidence available at request time
  instead of a result that silently changes with newer traffic.
- Expired activation requests cannot be approved. The previously active policy
  remains unchanged, and reminder, escalation, expiration, and Slack delivery
  outcomes are appended to the hash-chained audit log.
- Action-approval and policy notification writes are atomic with the event that
  created them. A unique channel/deduplication key prevents duplicate delivery
  jobs, and delivery never occurs while action, policy, or outbox row locks are
  held.
- Requests are tenant-scoped and idempotent.
- Pending decisions use conditional updates to prevent double approval.
- Execution outcomes use row locking and terminal-state protection to prevent
  concurrent or rewritten completion results.
- Audit events form an organization-level SHA-256 hash chain.
- PostgreSQL queries are parameterized and use a bounded connection pool.
- Slack is disabled unless `SLACK_APPROVAL_WEBHOOK_URL` is configured. The
  reminder dispatcher is separately disabled unless a strong
  `SENTINELOPS_CRON_SECRET` is configured.

This MVP is not yet a complete enterprise security product. SSO, SCIM,
fine-grained operator roles, expiring credentials, webhook signing, audit
export, retention controls, and formal compliance work remain later milestones.
