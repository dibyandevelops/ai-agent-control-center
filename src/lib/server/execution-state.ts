export type ExecutionStatus =
  | "not_started"
  | "executing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ReportableExecutionStatus = Exclude<
  ExecutionStatus,
  "not_started"
>;

const terminalStatuses = new Set<ExecutionStatus>([
  "succeeded",
  "failed",
  "cancelled",
]);

export function evaluateExecutionTransition(
  current: ExecutionStatus,
  requested: ReportableExecutionStatus,
): "transition" | "replay" | "conflict" {
  if (current === requested) return "replay";
  if (terminalStatuses.has(current)) return "conflict";
  return "transition";
}

export function isTerminalExecutionStatus(status: ExecutionStatus) {
  return terminalStatuses.has(status);
}
