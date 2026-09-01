"use client";

import {
  Building2,
  FileCheck2,
  KeyRound,
  Shield,
  User,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import type { DashboardView, OperatorIdentity } from "@/lib/types";
import { ProfileSettingsTab } from "../settings/profile-settings-tab";
import { OrganizationSettingsTab } from "../settings/organization-settings-tab";
import { GovernanceSettingsTab } from "../settings/governance-settings-tab";

type SettingsTab = "profile" | "organization" | "governance";

export function SettingsView({
  operator,
  canManageOperators,
  integrityVerified,
  onVerifyIntegrity,
  onUpdateOperatorName,
  onUpdateOrgName,
  onChangePassword,
  onSelectView,
}: {
  operator: OperatorIdentity | null;
  canManageOperators: boolean;
  integrityVerified: boolean;
  onVerifyIntegrity: () => Promise<void>;
  onUpdateOperatorName: (newName: string) => void;
  onUpdateOrgName: (newOrgName: string) => void;
  onChangePassword: () => void;
  onSelectView: (view: DashboardView) => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "organization", label: "Organization & Security", icon: Building2 },
    { id: "governance", label: "Audit & Governance", icon: Shield },
  ];

  return (
    <div className="page space-y-6">
      <div className="page-title-row">
        <div>
          <h2>Workspace & Account Settings</h2>
          <p className="text-xs text-sentinel-muted mt-1">
            Configure your operator credentials, organization workspace security, and compliance policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageOperators && (
            <button
              onClick={() => onSelectView("team")}
              className="secondary-button flex items-center gap-1.5"
            >
              <UsersRound className="h-3.5 w-3.5" />
              Manage Team & SCIM
            </button>
          )}
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-sentinel-line pb-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
                selected
                  ? "bg-sentinel-surface text-sentinel-lime border border-sentinel-line shadow-xs"
                  : "text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === "profile" && (
          <ProfileSettingsTab
            operator={operator}
            onUpdateOperatorName={onUpdateOperatorName}
            onChangePassword={onChangePassword}
          />
        )}

        {activeTab === "organization" && (
          <OrganizationSettingsTab
            operator={operator}
            canManage={canManageOperators}
            onUpdateOrgName={onUpdateOrgName}
          />
        )}

        {activeTab === "governance" && (
          <GovernanceSettingsTab
            integrityVerified={integrityVerified}
            onVerifyIntegrity={onVerifyIntegrity}
          />
        )}
      </div>
    </div>
  );
}
