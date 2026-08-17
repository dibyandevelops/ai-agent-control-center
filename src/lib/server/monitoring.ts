import "server-only";

import {
  createStructuredLog,
  type LogContext,
  type LogLevel,
  type StructuredLogEntry,
  redactSensitiveData,
} from "./monitoring-core";

export type { LogContext, LogLevel, StructuredLogEntry };
export { redactSensitiveData, createStructuredLog };

export function logError(error: unknown, message = "Unexpected error", context?: LogContext) {
  const entry = createStructuredLog("error", message, error, context);
  console.error(JSON.stringify(entry));
  return entry;
}

export function logWarn(message: string, context?: LogContext) {
  const entry = createStructuredLog("warn", message, undefined, context);
  console.warn(JSON.stringify(entry));
  return entry;
}

export function logInfo(message: string, context?: LogContext) {
  const entry = createStructuredLog("info", message, undefined, context);
  console.info(JSON.stringify(entry));
  return entry;
}
