export function isLoopbackHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

export function shouldBypassTurnstile(hostname: string, nodeEnvironment: string | undefined) {
  return nodeEnvironment !== "production" && isLoopbackHostname(hostname);
}
