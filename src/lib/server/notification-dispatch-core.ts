export function notificationOutboxEndpoint(input: {
  publicUrl?: string;
  vercelProductionUrl?: string;
}) {
  const configuredUrl = input.publicUrl?.trim();
  if (configuredUrl) {
    return `${configuredUrl.replace(/\/$/, "")}/api/v1/internal/notification-outbox`;
  }

  const vercelHost = input.vercelProductionUrl?.trim();
  if (!vercelHost) return null;
  const baseUrl = vercelHost.startsWith("http")
    ? vercelHost
    : `https://${vercelHost}`;
  return `${baseUrl.replace(/\/$/, "")}/api/v1/internal/notification-outbox`;
}

export async function triggerNotificationOutbox(input: {
  endpoint: string;
  cronSecret: string;
  fetcher?: typeof fetch;
}) {
  const response = await (input.fetcher ?? fetch)(input.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.cronSecret}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(55_000),
  });

  return {
    delivered: response.ok,
    status: response.status,
  };
}
