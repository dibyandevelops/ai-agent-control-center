import "server-only";

import { getServerEnv } from "./env";

export function getPolicyActivationSchedule() {
  const env = getServerEnv();
  return {
    ttlHours: env.POLICY_ACTIVATION_TTL_HOURS,
    reminderMinutes: env.POLICY_ACTIVATION_REMINDER_MINUTES,
  };
}
