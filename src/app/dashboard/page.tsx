import type { Metadata } from "next";
import {
  ControlCenter,
  type DashboardView,
} from "@/components/control-center";

export const metadata: Metadata = {
  title: "Control Center — SentinelOps",
  description: "Govern, approve, and audit every action taken by your AI workforce.",
};

const dashboardViews = new Set<DashboardView>([
  "overview",
  "agents",
  "approvals",
  "policies",
  "audit",
  "integrations",
  "credentials",
  "team",
]);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; eventId?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedView = params.view;
  const initialView = typeof requestedView === "string" &&
      dashboardViews.has(requestedView as DashboardView)
    ? requestedView as DashboardView
    : "overview";
  const initialAuditEventId = typeof params.eventId === "string" ? params.eventId : undefined;
  return <ControlCenter initialView={initialView} initialAuditEventId={initialAuditEventId} />;
}
