import "server-only";

import { after } from "next/server";
import { getServerEnv } from "./env";
import {
  notificationOutboxEndpoint,
  triggerNotificationOutbox,
} from "./notification-dispatch-core";

export function scheduleNotificationOutboxDispatch() {
  const env = getServerEnv();
  const endpoint = notificationOutboxEndpoint({
    publicUrl: env.SENTINELOPS_PUBLIC_URL,
    vercelProductionUrl: env.VERCEL_PROJECT_PRODUCTION_URL,
  });
  if (!endpoint || !env.SENTINELOPS_CRON_SECRET) return false;

  after(async () => {
    try {
      const result = await triggerNotificationOutbox({
        endpoint,
        cronSecret: env.SENTINELOPS_CRON_SECRET!,
      });
      if (!result.delivered) {
        console.error(
          `Near-real-time notification dispatch returned HTTP ${result.status}.`,
        );
      }
    } catch (error) {
      console.error(
        "Near-real-time notification dispatch failed; scheduled recovery remains active.",
        error,
      );
    }
  });

  return true;
}
