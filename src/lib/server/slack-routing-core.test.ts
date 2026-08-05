import { describe, expect, it } from "vitest";
import {
  normalizeSlackEventType,
  selectSlackRoutes,
  shouldRevokeSlackWorkspaceToken,
} from "./slack-routing-core";

const routes = [
  { id: "default", isDefault: true, eventTypes: [], minimumSeverity: "info" as const },
  {
    id: "incidents",
    isDefault: false,
    eventTypes: ["action.execution_failed", "github.release_drift_detected"],
    minimumSeverity: "high" as const,
  },
];

describe("Slack notification routing", () => {
  it("routes a matching high-severity event to specialized destinations", () => {
    expect(selectSlackRoutes(routes, "action.execution_failed", "high").map((route) => route.id))
      .toEqual(["incidents"]);
  });

  it("falls back safely when event or severity filters do not match", () => {
    expect(selectSlackRoutes(routes, "action.execution_failed", "medium").map((route) => route.id))
      .toEqual(["default"]);
    expect(selectSlackRoutes(routes, "action.approval_requested", "high").map((route) => route.id))
      .toEqual(["default"]);
  });

  it("normalizes policy notification variants into one configurable family", () => {
    expect(normalizeSlackEventType("policy.activation_escalation")).toBe("policy.activation");
  });

  it("revokes workspace access only after its last destination is removed", () => {
    expect(shouldRevokeSlackWorkspaceToken(0)).toBe(true);
    expect(shouldRevokeSlackWorkspaceToken(1)).toBe(false);
  });
});
