import { z } from "zod";

const senderSchema = z.object({
  login: z.string().trim().min(1).max(200),
});

const installationSchema = z.object({
  id: z.number().int().positive(),
  account: z.object({
    login: z.string().trim().min(1).max(200),
    type: z.string().trim().min(1).max(100).default("Organization"),
  }),
  repository_selection: z.enum(["all", "selected"]),
  permissions: z.record(z.string()).default({}),
  suspended_at: z.string().datetime().nullable().optional(),
});

const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string().trim().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  name: z.string().trim().min(1).max(200).optional(),
  private: z.boolean().default(true),
  default_branch: z.string().trim().min(1).max(255).default("main"),
  owner: z.object({
    login: z.string().trim().min(1).max(200),
  }).optional(),
});

export const githubInstallationWebhookSchema = z.object({
  action: z.enum([
    "created",
    "deleted",
    "suspend",
    "unsuspend",
    "new_permissions_accepted",
  ]),
  installation: installationSchema,
  sender: senderSchema,
});

export const githubInstallationRepositoriesWebhookSchema = z.object({
  action: z.enum(["added", "removed"]),
  installation: installationSchema,
  repository_selection: z.enum(["all", "selected"]),
  repositories_added: z.array(repositorySchema),
  repositories_removed: z.array(repositorySchema),
  sender: senderSchema,
});

export type GitHubInstallationWebhook = z.infer<
  typeof githubInstallationWebhookSchema
>;
export type GitHubInstallationRepositoriesWebhook = z.infer<
  typeof githubInstallationRepositoriesWebhookSchema
>;

export function installationStatusForAction(
  action: GitHubInstallationWebhook["action"],
) {
  if (action === "deleted") return "disconnected" as const;
  if (action === "suspend") return "suspended" as const;
  return "active" as const;
}

export function lifecycleAuditEvent(input: {
  eventName: "installation" | "installation_repositories";
  action: string;
}) {
  if (input.eventName === "installation_repositories") {
    return "github.app_repositories_changed" as const;
  }
  const events = {
    created: "github.app_installation_created",
    deleted: "github.app_installation_disconnected",
    suspend: "github.app_installation_suspended",
    unsuspend: "github.app_installation_resumed",
    new_permissions_accepted: "github.app_permissions_updated",
  } as const;
  return events[input.action as keyof typeof events];
}
