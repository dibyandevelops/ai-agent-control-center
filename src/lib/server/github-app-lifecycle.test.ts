import { describe, expect, it } from "vitest";
import {
  githubInstallationRepositoriesWebhookSchema,
  githubInstallationWebhookSchema,
  installationStatusForAction,
  lifecycleAuditEvent,
} from "./github-app-lifecycle";

const installation = {
  id: 151404943,
  account: { login: "aperture-labs", type: "Organization" },
  repository_selection: "selected",
  permissions: { contents: "write", metadata: "read" },
  suspended_at: null,
};

describe("GitHub App lifecycle webhooks", () => {
  it("maps suspension, resumption, and deletion to safe connection states", () => {
    expect(installationStatusForAction("suspend")).toBe("suspended");
    expect(installationStatusForAction("unsuspend")).toBe("active");
    expect(installationStatusForAction("deleted")).toBe("disconnected");
  });

  it("accepts signed installation lifecycle payload shapes", () => {
    const payload = githubInstallationWebhookSchema.parse({
      action: "suspend",
      installation: { ...installation, suspended_at: "2026-08-05T10:00:00Z" },
      sender: { login: "security-admin" },
    });
    expect(payload.installation.id).toBe(151404943);
    expect(lifecycleAuditEvent({ eventName: "installation", action: payload.action }))
      .toBe("github.app_installation_suspended");
  });

  it("accepts repository additions and removals", () => {
    const payload = githubInstallationRepositoriesWebhookSchema.parse({
      action: "removed",
      installation,
      repository_selection: "selected",
      repositories_added: [],
      repositories_removed: [{
        id: 42,
        full_name: "aperture-labs/payments",
        private: true,
      }],
      sender: { login: "security-admin" },
    });
    expect(payload.repositories_removed[0].default_branch).toBe("main");
    expect(lifecycleAuditEvent({
      eventName: "installation_repositories",
      action: payload.action,
    })).toBe("github.app_repositories_changed");
  });

  it("rejects unsupported actions and malformed repository names", () => {
    expect(() => githubInstallationWebhookSchema.parse({
      action: "transferred",
      installation,
      sender: { login: "security-admin" },
    })).toThrow();
    expect(() => githubInstallationRepositoriesWebhookSchema.parse({
      action: "added",
      installation,
      repository_selection: "selected",
      repositories_added: [{ id: 42, full_name: "not-a-repository" }],
      repositories_removed: [],
      sender: { login: "security-admin" },
    })).toThrow();
  });
});
