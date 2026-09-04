"use client";

import { CheckCircle2 } from "lucide-react";
import React from "react";
import type { Approval } from "@/lib/types";
import { EmptyState } from "../common/ui-helpers";
import { ApprovalCard } from "./approval-card";

export function ApprovalRail({
  approvals,
  onDecision,
  onViewAll,
  canDecide,
}: {
  approvals: Approval[];
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  onViewAll: () => void;
  canDecide: boolean;
}) {
  return (
    <aside className="approval-rail panel">
      <div className="section-heading">
        <div>
          <h2>Approval queue <span>{approvals.length}</span></h2>
          <p>Human review required</p>
        </div>
        <button className="text-button" onClick={onViewAll}>View all</button>
      </div>
      <div className="approval-list space-y-3">
        {approvals.length ? (
          approvals.slice(0, 3).map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onDecision={onDecision}
              canDecide={canDecide}
              compact={true}
            />
          ))
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Queue cleared"
            description="There are no actions waiting for human review."
          />
        )}
      </div>
    </aside>
  );
}
