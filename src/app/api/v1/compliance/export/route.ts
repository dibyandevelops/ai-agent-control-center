import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuditChain, type AuditChainEvent } from "@/lib/server/audit-chain";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  buildComplianceCertificate,
  type ComplianceExportPackage,
} from "@/lib/server/compliance-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }

    if (!operatorCan(operator.role, "export_audit")) {
      return NextResponse.json(
        { error: "Auditor or Admin role required to export compliance evidence." },
        { status: 403 },
      );
    }

    const { searchParams } = request.nextUrl;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const download = searchParams.get("download") === "true";
    const limit = Math.min(
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? "1000", 10) || 1000),
      5000,
    );

    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;

    const pool = getPool();

    // 1. Fetch organization metadata
    const orgResult = await pool.query<{
      id: string;
      name: string;
      slug: string;
    }>(
      `select id, name, slug from organizations where id = $1 limit 1`,
      [operator.organizationId],
    );
    const org = orgResult.rows[0];
    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    // 2. Fetch audit retention checkpoints
    const checkpointsResult = await pool.query<{ terminal_hash: string }>(
      `select terminal_hash
       from audit_retention_checkpoints
       where organization_id = $1
       order by end_time asc`,
      [operator.organizationId],
    );
    const checkpoints = checkpointsResult.rows.map((row) => ({
      terminalHash: row.terminal_hash,
    }));

    // 3. Fetch audit events in strictly ascending chronological order for chain verification
    const auditQueryConditions = ["ae.organization_id = $1"];
    const auditQueryParams: unknown[] = [operator.organizationId];

    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      auditQueryParams.push(fromDate);
      auditQueryConditions.push(`ae.created_at >= $${auditQueryParams.length}`);
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      auditQueryParams.push(toDate);
      auditQueryConditions.push(`ae.created_at <= $${auditQueryParams.length}`);
    }

    auditQueryParams.push(limit);
    const auditResult = await pool.query<{
      id: string;
      request_id: string | null;
      event_type: string;
      actor_type: "agent" | "policy" | "human" | "system";
      actor_id: string;
      payload: Record<string, unknown>;
      previous_hash: string | null;
      event_hash: string;
      created_at: Date;
    }>(
      `
        select
          ae.id::text,
          ae.request_id,
          ae.event_type,
          ae.actor_type,
          ae.actor_id,
          ae.payload,
          ae.previous_hash,
          ae.event_hash,
          ae.created_at
        from audit_events ae
        where ${auditQueryConditions.join(" and ")}
        order by ae.id asc
        limit $${auditQueryParams.length}
      `,
      auditQueryParams,
    );

    const auditChainEvents: AuditChainEvent[] = auditResult.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      eventType: row.event_type,
      actorType: row.actor_type,
      actorId: row.actor_id,
      payload: row.payload,
      previousHash: row.previous_hash,
      eventHash: row.event_hash,
    }));

    // 4. Verify cryptographic SHA-256 chain integrity
    const verification = verifyAuditChain(auditChainEvents, { checkpoints });
    const rootHash = auditChainEvents.length > 0 ? auditChainEvents[0].eventHash : null;
    const headHash =
      auditChainEvents.length > 0
        ? auditChainEvents[auditChainEvents.length - 1].eventHash
        : null;

    // 5. Fetch approver delegations
    const delegationsResult = await pool.query<{
      id: string;
      starts_at: Date;
      ends_at: Date;
      reason: string;
      active: boolean;
      delegator_email: string | null;
      delegatee_email: string | null;
    }>(
      `
        select
          d.id,
          d.starts_at,
          d.ends_at,
          d.reason,
          (d.starts_at <= now() and d.ends_at >= now()) as active,
          o1.email as delegator_email,
          o2.email as delegatee_email
        from approver_delegations d
        left join operators o1 on o1.id = d.delegator_operator_id
        left join operators o2 on o2.id = d.delegatee_operator_id
        where d.organization_id = $1
        order by d.created_at desc
        limit 50
      `,
      [operator.organizationId],
    );

    // 6. Fetch 4-Eyes release governance records
    const governanceResult = await pool.query<{
      id: string;
      action_request_id: string;
      operation: "publish" | "cancel";
      status: string;
      requested_by_email: string;
      reviewed_by_email: string | null;
      review_reason: string | null;
      requested_at: Date;
      reviewed_at: Date | null;
    }>(
      `
        select
          id,
          action_request_id,
          operation,
          status,
          requested_by_email,
          reviewed_by_email,
          review_reason,
          requested_at,
          reviewed_at
        from release_draft_governance_requests
        where organization_id = $1
        order by requested_at desc
        limit 50
      `,
      [operator.organizationId],
    );

    // 7. Fetch GitHub release drift containment incidents
    const driftResult = await pool.query<{
      id: string;
      repository: string;
      tag_name: string;
      severity: string;
      status: string;
      reason: string;
      containment_resource: string | null;
      detected_at: Date;
      resolved_at: Date | null;
    }>(
      `
        select
          id,
          repository,
          tag_name,
          severity,
          status,
          reason,
          containment_resource,
          detected_at,
          resolved_at
        from github_release_drift_incidents
        where organization_id = $1
        order by detected_at desc
        limit 50
      `,
      [operator.organizationId],
    );

    // 8. Build signed compliance certificate
    const certificateId = randomUUID();
    const issuedAt = new Date().toISOString();
    const standard =
      "SOC 2 Type II (Security, Availability, Confidentiality) / ISO 27001:2022 Annex A.12 / NIST SP 800-53 AU-9";

    const certificate = buildComplianceCertificate({
      certificateId,
      issuedAt,
      standard,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
      operator: {
        id: operator.id,
        email: operator.email,
        role: operator.role,
      },
      timeWindow: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
      },
      chainIntegrity: {
        verified: verification.verified,
        eventsEvaluated: auditChainEvents.length,
        checkpointsEvaluated: checkpoints.length,
        rootHash,
        headHash,
        firstInvalidEventId: verification.firstInvalidEventId,
      },
    });

    const exportPackage: ComplianceExportPackage = {
      certificate,
      auditTrail: auditResult.rows.map((row) => ({
        id: row.id,
        requestId: row.request_id,
        eventType: row.event_type,
        actorType: row.actor_type,
        actorId: row.actor_id,
        payload: row.payload,
        previousHash: row.previous_hash,
        eventHash: row.event_hash,
        createdAt: row.created_at.toISOString(),
      })),
      approverDelegations: delegationsResult.rows.map((row) => ({
        id: row.id,
        delegatorEmail: row.delegator_email,
        delegateeEmail: row.delegatee_email,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        reason: row.reason,
        active: row.active,
      })),
      governanceRecords: governanceResult.rows.map((row) => ({
        id: row.id,
        actionRequestId: row.action_request_id,
        operation: row.operation,
        status: row.status,
        requestedBy: row.requested_by_email,
        reviewedBy: row.reviewed_by_email,
        reviewReason: row.review_reason,
        requestedAt: row.requested_at.toISOString(),
        reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
      })),
      containmentIncidents: driftResult.rows.map((row) => ({
        id: row.id,
        repository: row.repository,
        tagName: row.tag_name,
        severity: row.severity,
        status: row.status,
        reason: row.reason,
        containmentResource: row.containment_resource,
        detectedAt: row.detected_at.toISOString(),
        resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
      })),
    };

    const responseHeaders: Record<string, string> = {
      "cache-control": "no-store, private",
      "content-type": "application/json; charset=utf-8",
    };

    if (download) {
      const filename = `sentinelops-soc2-audit-certificate-${org.slug}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      responseHeaders["content-disposition"] = `attachment; filename="${filename}"`;
    }

    return NextResponse.json(exportPackage, { headers: responseHeaders });
  } catch (error) {
    return apiError(error);
  }
}
