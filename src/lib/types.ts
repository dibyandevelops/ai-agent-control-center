export type AgentStatus = "healthy" | "review" | "blocked";
export type RiskLevel = "low" | "medium" | "high";
export type ApprovalStatus = "pending" | "approved" | "denied";
export type OperatorRole = "admin" | "approver" | "auditor";

export interface OperatorIdentity {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  displayName: string;
  role: OperatorRole;
}
export type ExecutionStatus =
  | "not_started"
  | "executing"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface Agent {
  id: string;
  name: string;
  description: string;
  owner: string;
  team: string;
  status: AgentStatus;
  provider: string;
  permissions: string[];
  actions: number;
  cost: number;
  lastAction: string;
  lastSeen: string;
  lastExecutionStatus?: ExecutionStatus;
}

export interface Approval {
  id: string;
  agentId: string;
  agentName: string;
  request: string;
  resource: string;
  context: string;
  risk: RiskLevel;
  requestedBy: string;
  requestedAt: string;
  status: ApprovalStatus;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  scope: string;
  mode: "Block" | "Approval" | "Monitor";
  enabled: boolean;
  matches: number;
}

export interface AuditEvent {
  id: string;
  requestId?: string | null;
  time: string;
  agent: string;
  action: string;
  result:
    | "Allowed"
    | "Approved"
    | "Blocked"
    | "Changed"
    | "Executing"
    | "Succeeded"
    | "Failed"
    | "Cancelled";
  actor: string;
  detail: string;
  externalReference?: string | null;
}

export interface ActionDetailEvent {
  id: string;
  time: string;
  eventType: string;
  actorType: "agent" | "policy" | "human" | "system";
  actor: string;
  status: string;
  detail: string;
  externalReference?: string | null;
}

export interface ActionDetail {
  requestId: string;
  action: string;
  resource: string;
  environment: "development" | "staging" | "production";
  risk: RiskLevel;
  requestedAt: string;
  context: Record<string, unknown>;
  agent: {
    name: string;
    owner: string;
    team: string;
    provider: string;
  };
  decision: {
    status: "allowed" | "pending" | "approved" | "denied" | "blocked";
    reason: string;
    policyName: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
  };
  execution: {
    status: ExecutionStatus;
    summary: string | null;
    errorCode: string | null;
    startedAt: string | null;
    completedAt: string | null;
    externalReference: string | null;
  };
  timeline: ActionDetailEvent[];
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  category: string;
  events: string;
  status?: "verified" | "configured" | "attention" | "not_connected";
  repository?: string;
  mode?: string;
  url?: string | null;
}
