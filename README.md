# SentinelOps

SentinelOps is an enforcement gateway for consequential AI-agent actions. The
first real vertical slice supports:

- tenant-scoped agent API keys;
- idempotent action evaluation;
- deterministic allow, approval, and block decisions;
- a human approval queue with a 5-second interactive Undo grace period;
- official Node.js / TypeScript SDK (`@sentinelops/sdk`) and Python SDK (`sentinelops-ai`) with Vercel AI SDK and LangChain integrations;
- immutable policy version history with four-eyes activation and rollback;
- database-backed operator accounts with role-based access;
- PostgreSQL persistence;
- hash-chained audit evidence and live SOC 2 / ISO 27001 cryptographic attestation certificates;
- real-time enterprise SIEM forwarder for Datadog Logs API, Splunk HEC, and HMAC-signed HTTPS webhooks;
- signed GitHub webhook reconciliation and release-drift incidents;
- agent-reported execution outcomes;
- durable Slack approval, failure, drift, and integration-security notifications;
- an interactive zero-trust policy simulator on `/docs` and `/get-started`; and
- a control center that can switch between preview and live data.

## Stack

The project uses a modern Next.js 16 App Router foundation: React 19,
TypeScript 5.9, Tailwind CSS 3, PostgreSQL, Zod, Vitest, ESLint, Lucide, and
pnpm.

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

## Organization SAML SSO

An organization admin can configure SAML SSO from **Dashboard → Team access →
Enterprise identity**. Paste the IdP entity ID, SSO entry point, signing
certificate in PEM format, and the assertion attribute containing the operator
email. SentinelOps exposes its service-provider metadata URL in the same card;
register its ACS URL with the IdP:

```text
https://YOUR-DOMAIN/api/v1/sso/saml/callback
```

Keep SSO disabled until the IdP configuration has been reviewed in staging.
Once enabled, an existing active operator can enter their email in **Connect
live** and choose **Sign in with your organization SSO**. SentinelOps validates
the signed response, its audience, correlation ID, expiry, and the asserted
email before creating its normal revocable, role-scoped session.

## Security digest delivery

SentinelOps sends a daily, tenant-scoped security digest through configured Slack
destinations and Resend email. Set `RESEND_API_KEY`, `SECURITY_DIGEST_FROM`, and
`SECURITY_DIGEST_TO` for email delivery. An administrator can use **Audit log →
Test security digest** to verify configured destinations; when MFA enforcement
is enabled, this test requires a recent MFA verification. The delivery test
reports each channel independently, so a Slack success and email failure can be
diagnosed without masking either result. For Resend 403 responses, verify that
the API key and sender domain belong to the same Resend account.

## Pilot onboarding checklist

Use this short path to validate a new tenant before its first real automation:

1. Sign in as an administrator and open **Overview → Register agent**. Enter a
   real owner email; the agent is tenant-scoped, persists after refresh, and
   creates an `agent.registered` audit event.
2. Open **Credentials**, create an API key, and store it in the agent's secret
   manager. SentinelOps never stores the plaintext value.
3. In the one-time key dialog, run **Test connection**. This performs a real,
   low-risk `system.health.read` policy evaluation and records key usage.
4. Use the language-specific quickstart snippet to send the first governed
   action. A production-impacting request should become pending, be approved by
   a different administrator when policy requires it, and be visible in the
   approval queue and audit log.
5. Configure Slack/email security-digest delivery and use **Test security
   digest** after MFA verification. Highlight links open the associated audit
   evidence directly.

The current Vercel Hobby deployment runs the daily digest at 08:00 UTC. Use a
Vercel plan that supports hourly cron or an external scheduler before offering
tenant-selected delivery times.

## Self-service organization onboarding

Set `SELF_SERVICE_SIGNUP_ENABLED=true` only after adding production abuse controls
(email/domain verification or invitation checks, then bot protection). When
enabled, **Create workspace** lets a founder create a tenant, its first local
administrator, a domain allow-list based on that administrator's work email,
and the default safety policies. The administrator remains inactive until they
verify a one-time Resend link that expires after 24 hours. Set
`ONBOARDING_EMAIL_FROM` to a verified sender, or it falls back to
`SECURITY_DIGEST_FROM`.
Onboarding is limited to five attempts per email and source IP address in each
15-minute window; only SHA-256 hashes of those rate-limit keys are stored.

### Optional Cloudflare Turnstile gate

After creating a Turnstile widget for the public SentinelOps hostname, set these
values in the matching Vercel environment:

```bash
TURNSTILE_ENABLED=true
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key
```

Keep `TURNSTILE_ENABLED=false` until both keys are present. When enabled, the
signup endpoint fails closed if the widget token is absent, invalid, expired, or
cannot be verified. The secret key is used only by the server and must never be
exposed in browser code.
Local development on `localhost`, `*.localhost`, `127.0.0.1`, or `::1`
automatically bypasses Turnstile; staging and production continue to enforce it.

## Paddle subscriptions

Paddle is the only enabled paid checkout provider. Sign-up always creates a
Pilot workspace; paid access is granted only for a verified Paddle subscription
in `active` or `trialing` status. `paused`, `past_due`, and `canceled` deny paid
access. A scheduled cancellation or pause does not revoke access before Paddle
reports the effective status. Apply database migrations through
`database/migrations/039_paddle_fulfillment.sql` before deploying this flow.

Before enabling live checkout:

1. Complete Paddle's seller onboarding and verify the payout method with Paddle.
   Seller approval and Nepal payout eligibility are controlled by Paddle.
2. The `/pricing` page uses Starter, Pro, and Advanced monthly/annual catalog
   prices. Configure all six `PADDLE_*_PRICE_ID` values for the same account
   named by `PADDLE_ENVIRONMENT`; they are deliberately not hard-coded or
   silently defaulted. Use sandbox IDs in staging and live IDs in production.
3. Add the matching Paddle API key, notification signing secret, client token,
   and six price IDs to the correct Vercel project/environment. Set both
   `PADDLE_ENVIRONMENT` and `NEXT_PUBLIC_PADDLE_ENVIRONMENT` to the same explicit
   value (`sandbox` or `production`). Keep
   `NEXT_PUBLIC_PADDLE_CHECKOUT_ENABLED=false` until seller verification and
   website approval are complete; the pricing page can still display Paddle's
   localized catalog prices while checkout is disabled.
4. Add `www.sentinelops-ai.com` as the approved/default checkout domain in
   Paddle and set `SENTINELOPS_PUBLIC_URL=https://www.sentinelops-ai.com` in the
   production environment. Configure DNS and the Vercel domain first.
5. In the Paddle **sandbox** dashboard, go to **Developer tools → Notifications**
   and create a destination pointing at
   `https://www.sentinelops-ai.com/api/v1/billing/paddle/webhook`. Subscribe to
   `customer.created`, `customer.updated`, `subscription.created`,
   `subscription.updated`, `subscription.canceled`, `subscription.trialing`,
   `subscription.activated`, `subscription.past_due`, `subscription.paused`,
   `subscription.resumed`, and `transaction.completed`.
   Copy that destination's notification signing secret into
   `PADDLE_WEBHOOK_SECRET` (it is not the API key). Create a separate destination
   in live after switching environments; never reuse the sandbox signing secret.
   The old `/api/v1/billing/dodopayments/webhook` URL remains as a compatibility
   alias for any already-configured destination.

Required environment values are listed in `.env.example`. Keep the API key and
webhook secret server-only. Do not use the old Stripe, Lemon Squeezy, or Dodo
simulator endpoints for paid access; legacy simulated mutations are rejected in
production. Billing changes and payment-method updates for paid workspaces use
Paddle's hosted customer portal. Verify purchases with Paddle sandbox cards
before switching the environment to production.

The public `/pricing` page uses Paddle.js to preview the Starter, Pro, and
Advanced sandbox catalog prices, including country overrides. Configure
`NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox` and a `test_` client-side token in
`.env.local`; the server API key remains server-only. To test sandbox checkout,
open Paddle **Checkout → Checkout settings** and set the default payment link to
the sandbox checkout page for this app (use `http://localhost:3000` for local
testing). For live checkout, use a real approved domain such as
`https://www.sentinelops-ai.com`, never localhost.

## Audit evidence export

Open **Audit log** and select **Export CSV** to download up to 5,000 immutable
audit events for the active organization. When **Security activity** is selected,
the export contains only identity, MFA, credential, GitHub App, and Slack events.
Every row includes the event and previous event hashes, enabling a customer to
retain evidence and independently verify the audit-chain linkage. CSV formula
values are escaped before download.

## SOC 2 & ISO 27001 compliance certificate

Open **Audit log** and select **Compliance Certificate** to generate an auditor-ready
Cryptographic Attestation Certificate in real time:

- **Attestation Digest**: A SHA-256 digest covering the active organization, total audit block count, verifiable hash-chain range, and current UTC timestamp.
- **Chain Root & Head Hashes**: The genesis block hash and the most recent block hash, proving uninterrupted cryptographic continuity.
- **Continuous Integrity Attestation**: Confirms that all historical transitions strictly satisfy SHA-256 parent-link integrity and that zero records have been mutated or deleted.
- **1-Click Evidence Export**: Select **Export Evidence (JSON)** to download a complete cryptographic evidence bundle for compliance auditors (SOC 2 Type II CC6.1/CC6.2, ISO/IEC 27001:2022 A.12.4).

## Approval queue with 5-second interactive Undo

Consequential AI actions requiring human clearance enter the operator approval
queue. When an operator clicks **Approve** or **Deny**:

1. **Sub-20ms Optimistic Update**: The UI responds immediately and removes the action from the pending review list.
2. **5-Second Grace Period & Undo Toast**: A toast notification appears with a 5-second visual countdown progress bar and an interactive **Undo** button.
3. **Accidental Click Reversal**: If the operator clicks **Undo**, the commit timer is cancelled immediately, the action returns to the pending queue, and **no API request or agent clearance is ever sent**.
4. **Finalized Dispatch**: If the 5-second countdown elapses without cancellation, the decision is dispatched to `POST /api/v1/actions/:requestId/decision`, recorded with PostgreSQL row-lock protection, sealed into the organization's SHA-256 audit chain, and broadcast to the waiting agent.

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

### Enterprise identity and SCIM

Administrators can open **Team access** and configure **Enterprise identity**.
Set the allowed company email domains first, then create a SCIM token and copy
it into an identity provider such as Okta, Microsoft Entra ID, or Google
Workspace. The token is shown once, stored only as a SHA-256 hash, and can be
rotated at any time. The tenant-specific SCIM endpoint is:

```text
https://sentinelops-staging.vercel.app/api/v1/scim/v2/Users
```

Use `Authorization: Bearer <SCIM token>`. SentinelOps supports SCIM 2.0 user
create, list/filter, lookup, and PATCH updates. The optional SentinelOps SCIM
extension accepts an operator role:

```json
{
  "userName": "maya@aperturelabs.com",
  "displayName": "Maya Patel",
  "active": true,
  "urn:sentinelops:schemas:extension:identity:2.0:User": {
    "role": "approver"
  }
}
```

Disabling a SCIM user revokes their active SentinelOps sessions immediately.
Every provision, update, deprovision, domain-policy change, and token rotation
is recorded in the organization's hash-chained audit log. SAML SSO is not
enabled by this MVP yet: it needs the customer's IdP metadata and a separately
configured assertion flow, which is the next identity milestone.

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
in a dead-letter state for investigation. Slack delivery uses
organization-scoped OAuth connections. Each organization can connect multiple
channels, mark one safe default, and route specialized event families by
minimum severity. Matching specialized routes receive the alert; when none
match, the default channel receives it so filtering cannot silently discard an
important notification. Webhook URLs are encrypted with AES-256-GCM and never
returned by the API. Unconnected organizations retain their notifications for
retry instead of falling back to another tenant's destination.

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

## Client SDKs

SentinelOps provides official client SDKs for TypeScript / Node.js and Python,
designed to integrate zero-trust governance into agent runtimes with minimal
latency (`<20ms` round-trip for allowed actions).

### TypeScript & Node.js SDK (`@sentinelops/sdk`)

Install from npm:

```bash
pnpm add @sentinelops/sdk
# or: npm install @sentinelops/sdk
```

Initialize client and evaluate actions:

```typescript
import { SentinelOps } from "@sentinelops/sdk";

const sentinel = new SentinelOps({
  apiKey: process.env.SENTINELOPS_AGENT_API_KEY!,
  baseUrl: "https://your-sentinelops-host", // or http://localhost:3000
});

// Synchronous policy evaluation (<20ms)
const decision = await sentinel.evaluate({
  agentId: "sales-agent-01",
  agentName: "Enterprise Sales Agent",
  action: "salesforce.deal.discount",
  resource: "deals/0015000000XyZ12",
  environment: "production",
  context: { discountPercent: 25, annualValue: 120000 },
});

if (decision.status === "allowed" || decision.status === "approved") {
  // Safe to execute consequential mutation
  await applyDiscount();
  await sentinel.reportOutcome(decision.requestId, "Discount applied successfully");
} else if (decision.status === "pending") {
  // High-risk: Polling for human-in-the-loop approval
  console.log("Hold: Waiting for 4-Eyes operator approval on Slack/Dashboard...");
  const finalized = await sentinel.pollApproval(decision.requestId, { timeoutSeconds: 300 });
  if (finalized.status === "approved") {
    await applyDiscount();
    await sentinel.reportOutcome(decision.requestId, "Discount approved and applied");
  }
}
```

#### Vercel AI SDK wrapper

```typescript
import { wrapGovernedTool } from "@sentinelops/sdk/vercel-ai";
import { tool } from "ai";
import { z } from "zod";

const transferFundsTool = wrapGovernedTool(
  tool({
    description: "Transfer money to vendor bank account",
    parameters: z.object({ recipientId: z.string(), amount: z.number() }),
    execute: async ({ recipientId, amount }) => executeBankWire(recipientId, amount),
  }),
  {
    client: sentinel,
    agentId: "finops-agent-01",
    action: "bank.wire.transfer",
    getResource: (args) => `accounts/${args.recipientId}`,
  }
);
```

#### LangChain.js callback handler

```typescript
import { SentinelOpsCallbackHandler } from "@sentinelops/sdk/langchain";

const model = new ChatOpenAI({
  callbacks: [
    new SentinelOpsCallbackHandler({
      client: sentinel,
      agentId: "langchain-agent",
      throwOnBlocked: true,
    }),
  ],
});
```

Run the live demonstration:

```bash
npx tsx sdk/typescript/examples/demo-governed-agent.ts
```

### Python SDK (`sentinelops-ai`)

Install from PyPI:

```bash
pip install sentinelops-ai
```

Evaluate policy decisions and use Python decorators:

```python
from sentinelops import SentinelOps, governed_action

sentinel = SentinelOps(
    api_key="sop_live_your_agent_api_key",
    base_url="https://your-sentinelops-host"
)

# Option A: Explicit evaluation
decision = sentinel.evaluate(
    agent_id="finops-01",
    action="stripe.transfers.create",
    resource="acct_987654",
    environment="production",
    context={"amount": 45000, "currency": "USD"}
)

if decision.allowed or decision.approved:
    execute_transfer()
    sentinel.report_outcome(decision.request_id, "Wire executed successfully")

# Option B: Method decorator
@governed_action(
    client=sentinel,
    agent_id="finops-01",
    action="database.records.delete"
)
def purge_user_records(user_id: str):
    db.users.delete(user_id)
```

Run the Python test suite:

```bash
cd sdk/python && pytest tests
```

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

## Enterprise SIEM & log streaming forwarder

SentinelOps provides real-time outbound streaming of tamper-evident audit logs to
enterprise Security Information and Event Management (SIEM) systems and security
data lakes (`src/lib/server/siem-stream.ts`):

- **Datadog Logs API v2**: Formats audit entries with `ddsource: "sentinelops"`,
  service tags, organization IDs, agent telemetry, and the complete SHA-256 hash
  chain link under `DD-API-KEY` authentication.
- **Splunk HTTP Event Collector (HEC)**: Dispatches JSON audit payloads to Splunk
  HEC endpoints (`Authorization: Splunk <token>`) targeted to a specific index
  and sourcetype (`sentinelops:audit:json`).
- **Generic HTTPS Webhooks**: Dispatches audit events with cryptographic HMAC-SHA256
  signatures in `x-sentinelops-signature`, ISO timestamps, and delivery IDs.
  Replay attacks beyond 5 minutes are rejected.
- **SSRF Protection**: Destination URLs are resolved and validated against
  private/internal IPv4 and IPv6 address ranges (loopback, link-local, RFC 1918,
  carrier-grade NAT) to prevent server-side request forgery.

## Interactive zero-trust policy simulator

To evaluate SentinelOps rules without setting up an agent runtime, visitors can
interact with the live Policy Simulator embedded on `/docs/connecting-agents` and
`/get-started`:

- **Real-Time Zero-Trust Engine**: Simulates sub-20ms policy evaluations,
  inspects condition matching, and generates live SHA-256 cryptographic hashes
  in the browser via WebCrypto.
- **Interactive Presets**:
  - *Safe Read (`system.health.read`)*: Simulates immediate automated clearance (`<20ms`).
  - *High-Risk Mutation (`wire.transfers.create`)*: Triggers the simulated 4-Eyes Slack approval queue card with interactive approve/reject actions.
  - *Destructive Action (`database.table.drop`)*: Instantly blocked by zero-trust guardrails.

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
  In the control center, decisions are protected by an interactive 5-second grace
  period with 1-click Undo before committing.
- `POST /api/v1/compliance/export` requires an authenticated operator session and
  generates an auditor-ready SOC 2 Type II and ISO/IEC 27001 Cryptographic
  Attestation Certificate JSON bundle with SHA-256 digests and unbroken chain links.
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
  prefix; create and rotate responses are explicitly non-cacheable. New and
  rotated credentials have an administrator-selected 30-to-365-day lifetime,
  default to 90 days, and are rejected by server-side authentication after the
  deadline.
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
- Slack delivery is disabled per organization until an administrator completes
  the tenant-bound OAuth flow. Multiple destinations remain isolated to that
  organization, and every routing-rule change is audit logged. The reminder
  dispatcher is separately disabled unless a strong
  `SENTINELOPS_CRON_SECRET` is configured.

SentinelOps adheres to zero-trust defense-in-depth principles: least privilege,
cryptographic verification, mutual exclusion across maker-checker roles,
sub-20ms policy enforcement SLAs, and continuous tamper-evident SOC 2 / ISO 27001
audit readiness.
