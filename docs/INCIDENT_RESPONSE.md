# SentinelOps Incident Response Runbook

This document defines the operational procedures, severity classifications, containment actions, and recovery protocols for security incidents and service disruptions in SentinelOps.

---

## 1. Severity Classifications

| Level | Severity | Description | Target Response | Target Resolution |
|---|---|---|---|---|
| **SEV-1** | **Critical** | Enforcement gateway bypass, audit hash chain broken, unauthorized production release execution, or primary control plane down. | < 15 min | < 2 hours |
| **SEV-2** | **High** | Unhandled release drift incident, compromised agent API key, SAML SSO degradation, or notification outbox blockage. | < 30 min | < 6 hours |
| **SEV-3** | **Medium / Low** | Rate-limit anomalies, isolated transient webhook delivery errors, non-blocking UI rendering bugs. | < 2 hours | < 24 hours |

---

## 2. Incident Response Roles & Communication

- **Incident Commander (IC)**: Leads triage, approves containment actions, and coordinates timeline.
- **Security & Platform Lead**: Executes credential revocations, drift containment, and forensic analysis.
- **Communications Lead**: Prepares internal and external status updates.
- **War Room Channel**: `#sentinelops-incident-live` (Slack / secure chat).

---

## 3. Immediate Containment Playbooks

### Playbook A: Compromised Agent API Key
1. **Immediate Revocation**:
   ```bash
   # Revoke the compromised key immediately via API or dashboard
   POST /api/v1/api-keys/{keyId}/rotate
   ```
2. **Review Action History**:
   - Query all actions submitted by the compromised key in the last 24 hours:
   ```sql
   SELECT id, action_type, status, evaluation_decision, payload, created_at
   FROM action_requests
   WHERE api_key_id = '$KEY_ID'
   ORDER BY created_at DESC;
   ```
3. **Quarantine Active Actions**:
   - Mark pending actions from the compromised key as rejected.

---

### Playbook B: Rogue Agent / Release Drift Containment
1. **Inspect Drift Incident**:
   - Check **Control Center → Drift Incidents** for unmanaged GitHub releases.
2. **Acknowledge & Contain**:
   ```bash
   POST /api/v1/github-drift/{incidentId}/acknowledge
   ```
3. **Rollback Release**:
   - Trigger automated containment rollback or delete unapproved tags/releases directly in GitHub.
4. **Mark Resolved**:
   ```bash
   POST /api/v1/github-drift/{incidentId}/resolve
   ```

---

### Playbook C: Compromised Operator Account
1. **Revoke All Operator Sessions**:
   ```sql
   UPDATE operator_sessions
   SET revoked_at = now()
   WHERE operator_id = '$OPERATOR_ID' AND revoked_at IS NULL;
   ```
2. **Disable Operator Account**:
   ```sql
   UPDATE operators
   SET status = 'disabled', updated_at = now()
   WHERE id = '$OPERATOR_ID';
   ```
3. **Audit History Review**:
   - Review all approvals and policy mutations performed by the compromised operator.

---

### Playbook D: SAML IdP Certificate Rotation / Emergency Cutover
1. **If SAML Certificate is Expired**:
   - Administrator accesses **Dashboard → Team access → Enterprise identity**.
   - Input updated X.509 PEM certificate and save.
2. **Emergency Fallback (if SAML IdP is Down)**:
   - Admin with break-glass MFA credentials can disable SAML enforcement via:
   ```bash
   PATCH /api/v1/identity/settings { "samlEnforced": false }
   ```

---

## 4. Four-Eyes Governance Integrity
Under no circumstances should four-eyes requirements be bypassed via direct database tampering without documenting an immutable audit trail. Any out-of-band intervention must record an audit event with detailed rationale.

---

## 5. Post-Incident Review (PIR) Template

Every SEV-1 and SEV-2 incident requires a completed PIR document within 48 hours covering:
1. **Executive Summary & Impact Duration**
2. **Root Cause Analysis (5 Whys)**
3. **Timeline of Detection, Containment, and Recovery**
4. **Audit Hash Continuity Confirmation**
5. **Action Items & Preventative Guardrails**
