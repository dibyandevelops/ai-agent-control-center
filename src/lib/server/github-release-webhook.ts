import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const githubReleaseWebhookSchema = z.object({
  action: z.enum([
    "created",
    "edited",
    "deleted",
    "published",
    "unpublished",
    "prereleased",
    "released",
  ]),
  release: z.object({
    id: z.number().int().positive(),
    tag_name: z.string().trim().min(1).max(200),
    draft: z.boolean(),
    html_url: z.string().url().nullable().optional(),
  }),
  repository: z.object({
    full_name: z.string().trim().min(3).max(300),
  }),
  sender: z.object({
    login: z.string().trim().min(1).max(200),
  }),
});

export type GitHubReleaseWebhook = z.infer<typeof githubReleaseWebhookSchema>;

export function verifyGitHubWebhookSignature(input: {
  secret: string;
  body: string;
  signature: string | null;
}) {
  if (!input.signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", input.secret)
    .update(input.body, "utf8")
    .digest("hex")}`;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(input.signature);
  return expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes);
}

type EvidenceStatus = "executing" | "succeeded" | null;

export function classifyGitHubReleaseMutation(input: {
  action: GitHubReleaseWebhook["action"];
  draft: boolean;
  draftCreationStatus: "executing" | "succeeded" | null;
  publicationStatus: EvidenceStatus;
  cancellationStatus: EvidenceStatus;
}) {
  const authorized = (status: EvidenceStatus) => status !== null;
  if (input.action === "created") {
    return input.draft && input.draftCreationStatus
      ? { outcome: "authorized" as const, reason: "Matched governed GitHub draft creation." }
      : {
          outcome: "drift" as const,
          severity: "high" as const,
          reason: "GitHub release was created without matching governed draft execution.",
        };
  }
  if (["published", "released", "prereleased"].includes(input.action)) {
    return authorized(input.publicationStatus)
      ? { outcome: "authorized" as const, reason: "Matched independently approved publication." }
      : {
          outcome: "drift" as const,
          severity: "critical" as const,
          reason: "GitHub release was published without independent SentinelOps approval.",
        };
  }
  if (input.action === "deleted") {
    return authorized(input.cancellationStatus)
      ? { outcome: "authorized" as const, reason: "Matched independently approved draft cancellation." }
      : {
          outcome: "drift" as const,
          severity: "critical" as const,
          reason: "GitHub release was deleted without independently approved cancellation.",
        };
  }
  if (input.action === "edited") {
    return {
      outcome: "drift" as const,
      severity: "high" as const,
      reason: "GitHub release metadata was edited outside a SentinelOps-governed operation.",
    };
  }
  return {
    outcome: "drift" as const,
    severity: "critical" as const,
    reason: "Published release state was reverted to an unpublished draft outside SentinelOps.",
  };
}
