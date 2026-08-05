import { NextRequest, NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getPool, withTransaction } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import {
  classifyGitHubReleaseMutation,
  githubReleaseWebhookSchema,
  verifyGitHubWebhookSignature,
} from "@/lib/server/github-release-webhook";
import { apiError } from "@/lib/server/http";
import { enqueueGitHubDriftNotification } from "@/lib/server/notification-outbox";

export const maxDuration = 30;

const supportedEvidenceStatuses = ["executing", "succeeded"];

export async function POST(request: NextRequest) {
  try {
    const env = getServerEnv();
    if (!env.GITHUB_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "GitHub release webhook is not configured." },
        { status: 503 },
      );
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 1_000_000) {
      return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
    }
    const body = await request.text();
    if (!verifyGitHubWebhookSignature({
      secret: env.GITHUB_WEBHOOK_SECRET,
      body,
      signature: request.headers.get("x-hub-signature-256"),
    })) {
      return NextResponse.json({ error: "Invalid GitHub webhook signature." }, { status: 401 });
    }

    const eventName = request.headers.get("x-github-event");
    if (eventName === "ping") return NextResponse.json({ status: "pong" });
    if (eventName !== "release") {
      return NextResponse.json({ status: "ignored", reason: "unsupported_event" }, { status: 202 });
    }
    const deliveryId = request.headers.get("x-github-delivery")?.trim();
    if (!deliveryId || deliveryId.length > 100) {
      return NextResponse.json({ error: "GitHub delivery identifier is required." }, { status: 400 });
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "GitHub webhook payload must be valid JSON." }, { status: 400 });
    }
    const payload = githubReleaseWebhookSchema.parse(json);
    const repositoryOwner = await getPool().query<{ organization_id: string }>(
      `select repository.organization_id
         from github_app_repositories repository
         join github_app_installations installation
           on installation.id = repository.installation_id
          and installation.organization_id = repository.organization_id
        where lower(repository.full_name) = lower($1)
          and repository.enabled = true
          and installation.status = 'active'
        limit 1`,
      [payload.repository.full_name],
    );
    const ownerOrganizationId = repositoryOwner.rows[0]?.organization_id ?? null;
    if (!ownerOrganizationId) {
      await getPool().query(
        `
          insert into github_webhook_deliveries (
            delivery_id, event_name, event_action, repository, tag_name,
            sender_login, outcome
          )
          values ($1, 'release', $2, $3, $4, $5, 'ignored')
          on conflict (delivery_id) do nothing
        `,
        [
          deliveryId,
          payload.action,
          payload.repository.full_name,
          payload.release.tag_name,
          payload.sender.login,
        ],
      );
      return NextResponse.json({ status: "ignored", reason: "repository_not_connected" }, { status: 202 });
    }

    const result = await withTransaction(async (client) => {
      const resource = `${payload.repository.full_name}@${payload.release.tag_name}`;
      const evidenceResult = await client.query<{
        id: string;
        organization_id: string;
        execution_status: "executing" | "succeeded" | string;
        publication_status: "executing" | "succeeded" | null;
        cancellation_status: "executing" | "succeeded" | null;
      }>(
        `
          select action.id, action.organization_id, action.execution_status,
                 publication.status as publication_status,
                 cancellation.status as cancellation_status
          from action_requests action
          left join lateral (
            select governance.status
            from release_draft_governance_requests governance
            where governance.action_request_id = action.id
              and governance.operation = 'publish'
              and governance.status = any($2::text[])
            order by governance.requested_at desc
            limit 1
          ) publication on true
          left join lateral (
            select governance.status
            from release_draft_governance_requests governance
            where governance.action_request_id = action.id
              and governance.operation = 'cancel'
              and governance.status = any($2::text[])
            order by governance.requested_at desc
            limit 1
          ) cancellation on true
          where lower(action.resource) = lower($1)
            and action.organization_id = $3
            and action.action in ('deploy.release', 'github.release.create')
          order by action.requested_at desc
          limit 1
        `,
        [resource, supportedEvidenceStatuses, ownerOrganizationId],
      );
      const evidence = evidenceResult.rows[0];
      const evidenceOrganizationId = ownerOrganizationId;
      const classification = classifyGitHubReleaseMutation({
        action: payload.action,
        draft: payload.release.draft,
        draftCreationStatus:
          evidence?.execution_status === "executing" ||
          evidence?.execution_status === "succeeded"
            ? evidence.execution_status
            : null,
        publicationStatus: evidence?.publication_status ?? null,
        cancellationStatus: evidence?.cancellation_status ?? null,
      });
      const delivery = await client.query<{ delivery_id: string }>(
        `
          insert into github_webhook_deliveries (
            delivery_id, organization_id, event_name, event_action,
            repository, tag_name, sender_login, outcome
          )
          values ($1, $2, 'release', $3, $4, $5, $6, $7)
          on conflict (delivery_id) do nothing
          returning delivery_id
        `,
        [
          deliveryId,
          evidenceOrganizationId,
          payload.action,
          payload.repository.full_name,
          payload.release.tag_name,
          payload.sender.login,
          classification.outcome,
        ],
      );
      if (!delivery.rows[0]) return { status: "duplicate" as const, incidentId: null };

      let incidentId: string | null = null;
      let notificationOutboxId: string | null = null;
      if (classification.outcome === "drift") {
        const incident = await client.query<{ id: string }>(
          `
            insert into github_release_drift_incidents (
              organization_id, action_request_id, delivery_id, repository,
              tag_name, github_release_id, event_action, severity, reason,
              actor_login, external_reference
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            returning id
          `,
          [
            evidenceOrganizationId,
            evidence?.id ?? null,
            deliveryId,
            payload.repository.full_name,
            payload.release.tag_name,
            payload.release.id,
            payload.action,
            classification.severity,
            classification.reason,
            payload.sender.login,
            payload.release.html_url ?? null,
          ],
        );
        incidentId = incident.rows[0].id;
        const notification = await enqueueGitHubDriftNotification(client, {
          organizationId: evidenceOrganizationId,
          payload: {
            incidentId,
            requestId: evidence?.id ?? null,
            repository: payload.repository.full_name,
            tagName: payload.release.tag_name,
            eventAction: payload.action,
            severity: classification.severity,
            actorLogin: payload.sender.login,
            reason: classification.reason,
            externalReference: payload.release.html_url ?? null,
          },
        });
        notificationOutboxId = notification.id;
      }
      await appendAuditEvent(client, {
        organizationId: evidenceOrganizationId,
        requestId: evidence?.id ?? null,
        eventType: classification.outcome === "drift"
          ? "github.release_drift_detected"
          : "github.release_webhook_authorized",
        actorType: "system",
        actorId: `github:${payload.sender.login}`,
        payload: {
          status: classification.outcome === "drift" ? "blocked" : "allowed",
          deliveryId,
          incidentId,
          repository: payload.repository.full_name,
          tagName: payload.release.tag_name,
          releaseId: payload.release.id,
          eventAction: payload.action,
          actorLogin: payload.sender.login,
          reason: classification.reason,
          notificationOutboxId,
          externalReference: payload.release.html_url ?? null,
        },
      });
      if (classification.outcome === "drift" && classification.severity === "critical") {
        await appendAuditEvent(client, {
          organizationId: evidenceOrganizationId,
          requestId: evidence?.id ?? null,
          eventType: "github.release_containment_activated",
          actorType: "system",
          actorId: "github-release-webhook",
          payload: {
            status: "blocked",
            incidentId,
            repository: payload.repository.full_name,
            tagName: payload.release.tag_name,
            resource,
            reason: classification.reason,
          },
        });
      }
      return { status: classification.outcome, incidentId };
    });
    return NextResponse.json(result, { status: result.status === "duplicate" ? 200 : 202 });
  } catch (error) {
    return apiError(error);
  }
}
