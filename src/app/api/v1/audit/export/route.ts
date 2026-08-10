import { NextRequest, NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

const securityEventPattern = /^(operator\.|identity\.|api_key\.|github_app\.|slack\.)/;

function csvValue(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  const formulaSafe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }

    const securityOnly = request.nextUrl.searchParams.get("scope") === "security";
    const result = await getPool().query<{
      id: string;
      created_at: Date;
      request_id: string | null;
      event_type: string;
      actor_type: string;
      actor_id: string;
      action: string | null;
      payload: Record<string, unknown>;
      previous_hash: string | null;
      event_hash: string;
    }>(
      `
        select
          ae.id::text,
          ae.created_at,
          ae.request_id,
          ae.event_type,
          ae.actor_type,
          ae.actor_id,
          ar.action,
          ae.payload,
          ae.previous_hash,
          ae.event_hash
        from audit_events ae
        left join action_requests ar on ar.id = ae.request_id
        where ae.organization_id = $1
          and ($2::boolean = false or ae.event_type ~ $3)
        order by ae.created_at desc, ae.id desc
        limit 5000
      `,
      [operator.organizationId, securityOnly, securityEventPattern.source],
    );

    const header = [
      "event_id",
      "occurred_at",
      "request_id",
      "event_type",
      "action",
      "actor_type",
      "actor_id",
      "payload",
      "previous_hash",
      "event_hash",
    ];
    const rows = result.rows.map((event) => [
      event.id,
      event.created_at.toISOString(),
      event.request_id,
      event.event_type,
      event.action,
      event.actor_type,
      event.actor_id,
      event.payload,
      event.previous_hash,
      event.event_hash,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const filename = `sentinelops-${securityOnly ? "security-" : ""}audit-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store, private",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
