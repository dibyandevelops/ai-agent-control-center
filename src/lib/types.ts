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
  mustChangePassword: boolean;
}

export interface OperatorAccount {
  id: string;
  email: string;
  displayName: string;
  role: OperatorRole;
  status: "active" | "disabled";
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AgentApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: "active" | "revoked";
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
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

export interface ReleaseGovernanceQueueItem {
  id: string;
  requestId: string;
  agentName: string;
  action: string;
  resource: string;
  operation: "publish" | "cancel";
  status:
    | "pending"
    | "approved"
    | "executing"
    | "failed";
  requestReason: string;
  requestedByOperatorId: string;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  executionAttemptCount: number;
  executionSummary: string | null;
  executionErrorCode: string | null;
  executionCompletedAt: string | null;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  scope: string;
  mode: "Block" | "Approval" | "Monitor";
  effect?: "block" | "approval" | "allow";
  priority?: number;
  conditions?: Array<{
    field: string;
    operator: "eq" | "in" | "gte" | "contains";
    value: string | number | boolean | Array<string | number | boolean>;
  }>;
  enabled: boolean;
  matches: number;
  activeVersionNumber?: number | null;
  latestVersionNumber?: number;
  activationStatus?: "draft" | "pending" | "active";
  pendingActivation?: {
    id: string;
    requestedByOperatorId?: string | null;
    requestedBy?: string;
    requestedAt: string | null;
    expiresAt?: string | null;
  } | null;
}

export interface PolicyActivationRequest {
  id: string;
  policyId: string;
  policyName: string;
  versionId: string;
  versionNumber: number;
  activeVersionNumber: number | null;
  effect: "block" | "approval" | "allow";
  requestedByOperatorId: string | null;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  reminderCount: number;
  escalatedAt: string | null;
  candidate: PolicyReviewSnapshot;
  active: PolicyReviewSnapshot | null;
  simulation: PolicyActivationSimulation;
}

export interface PolicyReviewSnapshot {
  versionNumber: number;
  name: string;
  description: string;
  priority: number;
  effect: "block" | "approval" | "allow";
  conditions: NonNullable<Policy["conditions"]>;
}

export interface PolicyActivationSimulation {
  actionsEvaluated: number;
  matchedCount: number;
  determiningCount: number;
  changedDecisionCount: number;
  simulatedAt: string;
  changedActions: Array<{
    requestId: string;
    agentName: string;
    action: string;
    resource: string;
    baselineEffect: "block" | "approval" | "allow";
    simulatedEffect: "block" | "approval" | "allow";
  }>;
}

export interface PolicyVersion {
  id: string;
  versionNumber: number;
  name: string;
  description: string;
  priority: number;
  effect: "block" | "approval" | "allow";
  conditions: NonNullable<Policy["conditions"]>;
  changeType: "created" | "edited" | "rollback";
  sourceVersionId: string | null;
  createdBy: string;
  createdAt: string;
  active: boolean;
  activation: {
    id: string;
    status: "pending" | "approved" | "rejected" | "expired";
    requestedBy: string | null;
    requestedAt: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    reason: string | null;
  } | null;
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
  draftGovernance: Array<{
    id: string;
    operation: "publish" | "cancel";
    status:
      | "pending"
      | "approved"
      | "rejected"
      | "expired"
      | "executing"
      | "succeeded"
      | "failed";
    requestReason: string;
    requestedByOperatorId: string;
    requestedBy: string;
    requestedAt: string;
    expiresAt: string;
    reviewedBy: string | null;
    reviewReason: string | null;
    reviewedAt: string | null;
    executionSummary: string | null;
    executionErrorCode: string | null;
    executionExternalReference: string | null;
  }>;
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
  deadLetters?: number;
}
