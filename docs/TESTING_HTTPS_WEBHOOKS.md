# SentinelOps HTTPS Webhooks Testing Guide

This guide details how to test the **Tenant-Scoped Signed HTTPS Webhooks** feature across automated tests, API workflows, signature verification, and UI operations.

---

## 1. Prerequisites & Environment Setup

Ensure the encryption key for webhook secrets and database credentials are configured in your `.env.local` or environment:

```bash
# 32-byte hex/base64 key for AES-256-GCM encryption of signing secrets
SLACK_CREDENTIAL_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Internal dispatcher secret for outbox processing
SENTINELOPS_CRON_SECRET="your-cron-secret"
```

### Apply Database Migrations
Run the database migrations to apply `031_https_webhooks.sql`:

```bash
npm run db:migrate
```

---

## 2. Automated Tests

### Run Unit Tests
Run Vitest to test HMAC signature generation, timestamp tolerance, and SSRF address protection:

```bash
# Run all tests
npm test

# Run HTTPS webhook core tests only
npx vitest run src/lib/https-webhook-core.test.ts

# Run plan limit tests
npx vitest run src/lib/server/plan-limits.test.ts
```

---

## 3. Testing via UI (Control Center Dashboard)

1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) and log in as an operator with **Admin** / `manage_integrations` role.
3. Navigate to **Integrations** -> **HTTPS Webhooks** card.
4. **Add Destination**:
   - Enter a Name (e.g. `SIEM Test Endpoint`).
   - Enter a valid public HTTPS URL (e.g. `https://webhook.site/...` or your public collector endpoint).
   - Click **Add destination**.
   - *Note:* The signing secret (`swhsec_...`) will be displayed **once**. Copy and save it.
5. **Test Delivery**:
   - Click **Test** on the webhook card.
   - The test sends an `https.webhook_tested` event to your destination and records the delivery status or any error in real time.
6. **Manage Webhook**:
   - Click **Pause** / **Enable** to toggle delivery without deleting the destination.
   - Click **Rotate** to generate a new signing secret (requires copying the new key).
   - Click **Revoke** to permanently remove the webhook destination.

---

## 4. Testing via REST API

### A. Create an HTTPS Webhook Destination
```bash
curl -X POST http://localhost:3000/api/v1/https-webhooks \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "name": "Datadog SIEM",
    "destinationUrl": "https://http-intake.logs.datadoghq.com/api/v2/logs"
  }'
```
**Response (201 Created):**
```json
{
  "webhook": {
    "id": "7b8e1f0e-...",
    "name": "Datadog SIEM",
    "destinationUrl": "https://http-intake.logs.datadoghq.com/api/v2/logs",
    "secretPrefix": "swhsec_a1b2c3",
    "enabled": true,
    "lastDeliveredAt": null,
    "lastError": null
  },
  "signingSecret": "swhsec_a1b2c3d4e5f6..."
}
```

### B. List Webhooks
```bash
curl http://localhost:3000/api/v1/https-webhooks \
  -H "Cookie: <your-session-cookie>"
```

### C. Trigger a Test Delivery
```bash
curl -X POST http://localhost:3000/api/v1/https-webhooks/<webhook-id>/test \
  -H "Cookie: <your-session-cookie>"
```

### D. Rotate Signing Secret
```bash
curl -X POST http://localhost:3000/api/v1/https-webhooks/<webhook-id>/rotate \
  -H "Cookie: <your-session-cookie>"
```

### E. Pause or Enable Destination
```bash
curl -X PATCH http://localhost:3000/api/v1/https-webhooks/<webhook-id> \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"enabled": false}'
```

### F. Revoke Webhook
```bash
curl -X DELETE http://localhost:3000/api/v1/https-webhooks/<webhook-id> \
  -H "Cookie: <your-session-cookie>"
```

---

## 5. Testing Event Fan-Out & Outbox Dispatch

When policy evaluations, approvals, drift incidents, or security events occur, SentinelOps automatically inserts a fan-out item into `notification_outbox` for each enabled HTTPS webhook.

### Triggering the Outbox Worker
To deliver pending outbox notifications to your HTTPS endpoints:

```bash
curl -X POST http://localhost:3000/api/v1/internal/notification-outbox \
  -H "Authorization: Bearer <SENTINELOPS_CRON_SECRET>"
```

---

## 6. Verifying Webhook Signatures on the Receiver

Each delivery includes the following HTTP headers:

| Header | Description | Example |
| :--- | :--- | :--- |
| `x-sentinelops-delivery-id` | Unique UUID for the delivery attempt | `3c874b0f-859a-4cbb-9273-df2674e2d31c` |
| `x-sentinelops-timestamp` | Unix epoch timestamp in seconds | `1771664400` |
| `x-sentinelops-signature` | `v1=` prefixed HMAC-SHA256 signature | `v1=8f54a84e27b...` |
| `x-sentinelops-event` | Event type name | `action.approval_requested` |

### Verification Example (Node.js / TypeScript)

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyWebhook(secret: string, timestamp: string, rawBody: string, receivedSignature: string): boolean {
  // Reject signatures older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const expectedDigest = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  
  const expectedSignature = Buffer.from(`v1=${expectedDigest}`);
  const providedSignature = Buffer.from(receivedSignature);

  if (expectedSignature.length !== providedSignature.length) return false;
  return timingSafeEqual(expectedSignature, providedSignature);
}
```

### Verification Example (Python)

```python
import hmac
import hashlib
import time

def verify_webhook(secret: str, timestamp: str, raw_body: str, received_signature: str) -> bool:
    # Reject timestamp drift > 5 minutes
    if abs(time.time() - int(timestamp)) > 300:
        return False
    
    payload = f"{timestamp}.{raw_body}".encode("utf-8")
    expected_digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    expected_signature = f"v1={expected_digest}"
    
    return hmac.compare_digest(expected_signature, received_signature)
```

---

## 7. SSRF Protection Validation

SentinelOps strictly blocks unroutable, local, and metadata endpoints. You can verify that destination URLs like the following are rejected with validation errors:

- `http://...` (Non-HTTPS)
- `https://localhost/...` or `https://127.0.0.1/...` (Loopback)
- `https://10.0.0.1/...` or `https://192.168.1.1/...` (RFC1918 Private Subnets)
- `https://169.254.169.254/...` (Cloud Instance Metadata Service)
- `https://internal.corp/...` (Resolves to private IP)
