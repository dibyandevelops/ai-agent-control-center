"use client";

import {
  Bell,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import React from "react";
import type { DashboardView } from "@/lib/types";

interface NotificationPopoverProps {
  open: boolean;
  onClose: () => void;
  pendingApprovalsCount: number;
  quarantinedAgentsCount: number;
  integrityVerified: boolean;
  onSelectView: (view: DashboardView) => void;
}

export function NotificationPopover({
  open,
  onClose,
  pendingApprovalsCount,
  quarantinedAgentsCount,
  integrityVerified,
  onSelectView,
}: NotificationPopoverProps) {
  if (!open) return null;

  const notifications = [
    {
      id: "approvals",
      title: `${pendingApprovalsCount} Action Approval${pendingApprovalsCount === 1 ? "" : "s"} Pending`,
      description:
        pendingApprovalsCount > 0
          ? "High-impact agent operations awaiting four-eyes sign-off."
          : "All pending action requests have been reviewed.",
      icon: FileCheck2,
      tone: pendingApprovalsCount > 0 ? "text-sentinel-amber" : "text-sentinel-lime",
      action: () => {
        onSelectView("approvals");
        onClose();
      },
    },
    ...(quarantinedAgentsCount > 0
      ? [
          {
            id: "quarantine",
            title: `${quarantinedAgentsCount} Agent Under Emergency Killswitch`,
            description: "Agent actions are actively blocked across all environments.",
            icon: ShieldAlert,
            tone: "text-sentinel-red",
            action: () => {
              onSelectView("agents");
              onClose();
            },
          },
        ]
      : []),
    {
      id: "integrity",
      title: integrityVerified ? "Audit Chain Intact" : "Audit Chain Pending Check",
      description: integrityVerified
        ? "All cryptographic event hashes and seals are verified."
        : "Run periodic hash verification in the Audit log.",
      icon: ShieldCheck,
      tone: integrityVerified ? "text-sentinel-lime" : "text-sentinel-muted",
      action: () => {
        onSelectView("audit");
        onClose();
      },
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-12 top-14 z-50 w-80 sm:w-96 rounded-2xl border border-sentinel-line-strong bg-sentinel-surface shadow-2xl p-4 animate-dialog-in">
        <div className="flex items-center justify-between border-b border-sentinel-line pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-sentinel-lime" />
            <h3 className="text-sm font-semibold text-sentinel-text">Notifications</h3>
          </div>
          <button
            className="grid h-6 w-6 place-items-center rounded text-sentinel-muted hover:text-sentinel-text"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {notifications.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-sentinel-raised group"
                onClick={item.action}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.tone}`} />
                <div className="min-w-0 flex-1">
                  <strong className="block text-xs font-semibold text-sentinel-text group-hover:text-sentinel-lime">
                    {item.title}
                  </strong>
                  <p className="mt-0.5 text-[11px] leading-4 text-sentinel-muted">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-sentinel-line pt-2.5 mt-3 text-center">
          <button
            className="text-[11px] font-medium text-sentinel-lime hover:underline"
            onClick={() => {
              onSelectView("audit");
              onClose();
            }}
          >
            View full audit trail →
          </button>
        </div>
      </div>
    </>
  );
}
