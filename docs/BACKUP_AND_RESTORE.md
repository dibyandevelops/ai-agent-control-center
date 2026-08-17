# SentinelOps Database Backup and Recovery Runbook

This document details the production backup, archival, point-in-time recovery (PITR), and restoration procedures for the SentinelOps enforcement gateway PostgreSQL persistence layer.

---

## 1. Overview & Recovery Objectives

| Metric | Target | Description |
|---|---|---|
| **Recovery Point Objective (RPO)** | **≤ 5 minutes** | Maximum allowable data loss in the event of primary database cluster disaster. |
| **Recovery Time Objective (RTO)** | **≤ 15 minutes** | Maximum allowable time to restore service from backup and verify audit integrity. |
| **Audit Log Retention** | **365 days** (configurable up to 10 years) | Hash-chained audit logs preserved under tamper-evident immutable storage. |

---

## 2. Backup Strategy & Architecture

### 2.1 Continuous Archiving (Physical Backups & WAL Archiving)
- **Base Snapshots**: Automated daily physical storage snapshots taken at 02:00 UTC.
- **WAL Archiving**: Write-Ahead Logs (WAL) streamed continuously to multi-region encrypted object storage (e.g. AWS S3 / Google Cloud Storage with bucket versioning and object lock).
- **Encryption**: AES-256 / KMS customer-managed key encryption at rest; TLS 1.3 in transit.

### 2.2 Logical Backups (`pg_dump`)
Logical backups are taken before major migrations or schema changes:

```bash
# Export transactional snapshot with consistent schema and data
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  --file="sentinelops-backup-$(date +%Y%m%d%H%M%S).dump"
```

---

## 3. Step-by-Step Restoration Playbook

### Step 1: Provision Isolated Target Database
Ensure target PostgreSQL instance matches production version (PostgreSQL 16+):

```bash
# Verify target database connectivity
export TARGET_DATABASE_URL="postgresql://user:password@target-host:5432/sentinelops_recovery"
psql "$TARGET_DATABASE_URL" -c "SELECT version();"
```

### Step 2: Restore Logical Backup or Replay WAL
For logical restoration:

```bash
# Restore schema and data
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$TARGET_DATABASE_URL" \
  "sentinelops-backup-YYYYMMDDHHMMSS.dump"
```

### Step 3: Run Database Migrations
Ensure all pending migration steps are recorded and applied:

```bash
DATABASE_URL="$TARGET_DATABASE_URL" pnpm db:migrate
```

### Step 4: Verify Cryptographic Audit Chain Integrity
SentinelOps maintains an unbroken SHA-256 hash chain for all governance and authorization decisions. Validate chain continuity immediately post-restore:

```sql
-- Query audit log chain continuity
SELECT
  id,
  sequence_number,
  event_type,
  current_hash,
  previous_hash,
  created_at
FROM audit_events
ORDER BY sequence_number DESC
LIMIT 20;
```

Or trigger the integrity verification endpoint:
```bash
curl -X GET -H "Authorization: Bearer $ADMIN_SESSION" "$TARGET_BASE_URL/api/v1/audit/integrity"
```

### Step 5: Smoke Test & System Health Verification
Verify all gateway interfaces:

```bash
# Check service health and database connection
curl -sS "$TARGET_BASE_URL/api/health"

# Run automated end-to-end verification
SENTINELOPS_E2E_BASE_URL="$TARGET_BASE_URL" pnpm test:e2e:staging
```

---

## 4. Disaster Recovery Drills
- Recovery drills must be conducted **monthly** on the staging environment.
- Any discrepancy in audit hash validation or data truncation triggers an immediate SEV-1 audit review.
