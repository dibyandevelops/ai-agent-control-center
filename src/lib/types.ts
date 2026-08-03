export type AgentStatus = "healthy" | "review" | "blocked";
export type RiskLevel = "low" | "medium" | "high";
export type ApprovalStatus = "pending" | "approved" | "denied";
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
