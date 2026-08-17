export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  organizationId?: string;
  operatorId?: string;
  requestId?: string;
  action?: string;
  route?: string;
  metadata?: Record<string, unknown>;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  message: string;
  organizationId?: string;
  operatorId?: string;
  requestId?: string;
  action?: string;
  route?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

const sensitiveKeys = new Set([
  "password",
  "password_hash",
  "passwordhash",
  "secret",
  "token",
  "token_hash",
  "tokenhash",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "private_key",
  "certificate",
  "idpcertificate",
]);

export function redactSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (data === null || data === undefined) return data;
  if (typeof data === "string") {
    // Redact recognized bearer tokens and API keys
    return data
      .replace(/sop_live_[A-Za-z0-9_-]+/g, "sop_live_[REDACTED]")
      .replace(/sos_session_[A-Za-z0-9_-]+/g, "sos_session_[REDACTED]")
      .replace(/sop_inv_[A-Za-z0-9_-]+/g, "sop_inv_[REDACTED]")
      .replace(/sop_reset_[A-Za-z0-9_-]+/g, "sop_reset_[REDACTED]")
      .replace(/sos_scim_[A-Za-z0-9_-]+/g, "sos_scim_[REDACTED]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  }
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveKeys.has(key.toLowerCase().replace(/[^a-z]/g, ""))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = redactSensitiveData(value, depth + 1);
    }
  }
  return sanitized;
}

export function createStructuredLog(
  level: LogLevel,
  message: string,
  error?: unknown,
  context?: LogContext,
): StructuredLogEntry {
  const env = process.env.NODE_ENV ?? "development";
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: "sentinelops-control-plane",
    environment: env,
    message: String(redactSensitiveData(message)),
  };

  if (context?.organizationId) entry.organizationId = context.organizationId;
  if (context?.operatorId) entry.operatorId = context.operatorId;
  if (context?.requestId) entry.requestId = context.requestId;
  if (context?.action) entry.action = context.action;
  if (context?.route) entry.route = context.route;
  if (context?.metadata) {
    entry.metadata = redactSensitiveData(context.metadata) as Record<string, unknown>;
  }

  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: String(redactSensitiveData(error.message)),
        stack: error.stack ? String(redactSensitiveData(error.stack)) : undefined,
      };
    } else {
      entry.error = {
        name: "UnknownError",
        message: String(redactSensitiveData(String(error))),
      };
    }
  }

  return entry;
}
