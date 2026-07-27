# SentinelOps

SentinelOps is an interactive MVP for governing enterprise AI agents. It provides:

- an operational overview with agent activity and risk posture;
- an agent registry with permission visibility;
- human-in-the-loop approval workflows;
- enforceable policy controls;
- an audit trail for every decision; and
- integration health across enterprise systems.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for the product landing
page or [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for
the interactive control center.

The MVP ships with realistic demo data and persists approvals, policy toggles, and registered agents in the browser. No credentials or database are required.

## Production direction

Replace the demo state layer with PostgreSQL, add SSO/SCIM, ingest events through signed webhooks, and enforce policies through a gateway SDK before connecting real enterprise systems.
