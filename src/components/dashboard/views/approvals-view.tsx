"use client";

import { CheckCircle2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import type { Approval, ReleaseGovernanceQueueItem } from "@/lib/types";
import { ReleaseGovernanceQueue } from "@/components/release-governance-queue";
import { TablePagination } from "@/components/table-pagination";
import { ApprovalCard } from "./overview-view";
import { EmptyState } from "../common/ui-helpers";

export function ApprovalsView({
  approvals,
  releaseGovernance,
  operatorId,
  onDecision,
  onReleaseDecision,
  onReleaseRetry,
  onViewEvidence,
  canDecide,
  canGovernReleases,
}: {
  approvals: Approval[];
  releaseGovernance: ReleaseGovernanceQueueItem[];
  operatorId: string | null;
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  onReleaseDecision: (
    governanceId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) => Promise<void>;
  onReleaseRetry: (governanceId: string) => Promise<void>;
  onViewEvidence: (requestId: string) => void;
  canDecide: boolean;
  canGovernReleases: boolean;
}) {
  const [filter, setFilter] = useState<"pending" | "high_risk" | "assigned">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const filteredApprovals = useMemo(() => {
    if (filter === "high_risk") {
      return approvals.filter((a) => a.risk === "high");
    }
    return approvals;
  }, [approvals, filter]);

  const paginatedApprovals = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredApprovals.slice(startIndex, startIndex + pageSize);
  }, [filteredApprovals, currentPage, pageSize]);

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>Approval queue</h2>
          <p>Review consequential actions before they reach production systems.</p>
        </div>
      </div>
      <div className="filter-row">
        <button
          className={`filter-chip ${filter === "pending" ? "filter-active" : ""}`}
          onClick={() => {
            setFilter("pending");
            setCurrentPage(1);
          }}
        >
          Pending <span>{approvals.length}</span>
        </button>
        <button
          className={`filter-chip ${filter === "high_risk" ? "filter-active" : ""}`}
          onClick={() => {
            setFilter("high_risk");
            setCurrentPage(1);
          }}
        >
          High risk <span>{approvals.filter((a) => a.risk === "high").length}</span>
        </button>
        <button
          className={`filter-chip ${filter === "assigned" ? "filter-active" : ""}`}
          onClick={() => {
            setFilter("assigned");
            setCurrentPage(1);
          }}
        >
          Assigned to me
        </button>
      </div>
      {filteredApprovals.length ? (
        <div className="space-y-4">
          <div className="approvals-grid">
            {paginatedApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onDecision={onDecision}
                canDecide={canDecide}
                detailed
              />
            ))}
          </div>
          {filteredApprovals.length > 6 && (
            <TablePagination
              currentPage={currentPage}
              totalItems={filteredApprovals.length}
              pageSize={pageSize}
              pageSizeOptions={[6, 12, 24]}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="approvals"
            />
          )}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            icon={CheckCircle2}
            title="Everything is reviewed"
            description="New high-impact agent actions will appear here."
          />
        </section>
      )}
      <ReleaseGovernanceQueue
        items={releaseGovernance}
        operatorId={operatorId}
        canGovern={canGovernReleases}
        onDecision={onReleaseDecision}
        onRetry={onReleaseRetry}
        onViewEvidence={onViewEvidence}
      />
    </main>
  );
}
