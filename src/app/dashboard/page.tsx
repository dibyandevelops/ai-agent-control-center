import type { Metadata } from "next";
import { ControlCenter } from "@/components/control-center";

export const metadata: Metadata = {
  title: "Control Center — SentinelOps",
  description: "Govern, approve, and audit every action taken by your AI workforce.",
};

export default function DashboardPage() {
  return <ControlCenter />;
}
