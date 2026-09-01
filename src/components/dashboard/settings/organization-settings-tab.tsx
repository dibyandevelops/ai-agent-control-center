"use client";

import {
  AlertTriangle,
  Building2,
  Check,
  CreditCard,
  Globe,
  LoaderCircle,
  Lock,
  Save,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { OperatorIdentity } from "@/lib/types";

export function OrganizationSettingsTab({
  operator,
  canManage,
  onUpdateOrgName,
}: {
  operator: OperatorIdentity | null;
  canManage: boolean;
  onUpdateOrgName: (name: string) => void;
}) {
  const [orgName, setOrgName] = useState(operator?.organizationName || "");
  const [planCode, setPlanCode] = useState<string>("pro");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainsInput, setDomainsInput] = useState<string>("");
  const [sessionMaxDuration, setSessionMaxDuration] = useState<number>(480);
  const [sessionIdleTimeout, setSessionIdleTimeout] = useState<number>(60);
  const [emergencyLockdown, setEmergencyLockdown] = useState<boolean>(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrgData() {
      try {
        const [orgRes, identityRes] = await Promise.all([
          fetch("/api/v1/organization/settings"),
          fetch("/api/v1/identity/settings"),
        ]);

        if (orgRes.ok) {
          const orgData = await orgRes.json();
          if (orgData.organization?.name) {
            setOrgName(orgData.organization.name);
          }
          if (orgData.organization?.planCode) {
            setPlanCode(orgData.organization.planCode);
          }
        }

        if (identityRes.ok) {
          const idData = await identityRes.json();
          if (idData.allowedEmailDomains) {
            setAllowedDomains(idData.allowedEmailDomains);
            setDomainsInput(idData.allowedEmailDomains.join(", "));
          }
          if (idData.sessionPolicy?.maxDurationMinutes) {
            setSessionMaxDuration(idData.sessionPolicy.maxDurationMinutes);
          }
          if (idData.sessionPolicy?.idleTimeoutMinutes) {
            setSessionIdleTimeout(idData.sessionPolicy.idleTimeoutMinutes);
          }
        }
      } catch (err) {
        // Fallbacks
      } finally {
        setLoading(false);
      }
    }

    void loadOrgData();
  }, []);

  async function handleSaveOrgSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setErrorMessage(null);

    try {
      // 1. Update Org Name
      const orgRes = await fetch("/api/v1/organization/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() }),
      });

      if (!orgRes.ok) {
        const err = await orgRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update organization name.");
      }

      // 2. Parse domains
      const parsedDomains = domainsInput
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      // 3. Update Identity & Security Settings
      const idRes = await fetch("/api/v1/identity/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedEmailDomains: parsedDomains,
          sessionPolicy: {
            maxDurationMinutes: Number(sessionMaxDuration),
            idleTimeoutMinutes: Number(sessionIdleTimeout),
          },
        }),
      });

      if (!idRes.ok) {
        const err = await idRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update identity policy.");
      }

      onUpdateOrgName(orgName.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Organization Header Card */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-sentinel-line">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-sentinel-surface-raised border border-sentinel-line flex items-center justify-center text-sentinel-lime shadow-sm">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-sentinel-text">
                {orgName || "Organization Workspace"}
              </h3>
              <p className="text-xs text-sentinel-muted">
                Workspace ID: <span className="font-mono text-sentinel-text">{operator?.organizationId || "org_primary"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-3 py-1 text-xs font-semibold text-sentinel-lime capitalize">
              <Sparkles className="h-3.5 w-3.5" />
              {planCode} Plan Active
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSaveOrgSettings} className="mt-6 space-y-5 max-w-xl">
          {errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {savedSuccess && (
            <div className="rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/10 p-3 text-xs text-sentinel-lime flex items-center gap-2">
              <Check className="h-4 w-4" />
              Organization & security settings updated successfully.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-sentinel-text mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime transition disabled:opacity-50"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Aperture Labs, Inc."
              disabled={!canManage || loading}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sentinel-text mb-1.5 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-sentinel-muted" />
              Allowed Email Domains for Team Invites
            </label>
            <input
              type="text"
              className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime transition disabled:opacity-50 font-mono"
              value={domainsInput}
              onChange={(e) => setDomainsInput(e.target.value)}
              placeholder="company.com, engineering.io"
              disabled={!canManage || loading}
            />
            <p className="mt-1 text-[11px] text-sentinel-muted">
              Comma-separated domains. When specified, only operators with these email domains can join.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-sentinel-text mb-1.5">
                Session Max Duration (Minutes)
              </label>
              <select
                className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime transition disabled:opacity-50"
                value={sessionMaxDuration}
                onChange={(e) => setSessionMaxDuration(Number(e.target.value))}
                disabled={!canManage || loading}
              >
                <option value={60}>1 Hour</option>
                <option value={240}>4 Hours</option>
                <option value={480}>8 Hours (Default)</option>
                <option value={720}>12 Hours</option>
                <option value={1440}>24 Hours</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-sentinel-text mb-1.5">
                Session Idle Timeout (Minutes)
              </label>
              <select
                className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime transition disabled:opacity-50"
                value={sessionIdleTimeout}
                onChange={(e) => setSessionIdleTimeout(Number(e.target.value))}
                disabled={!canManage || loading}
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes (Default)</option>
                <option value={120}>2 Hours</option>
              </select>
            </div>
          </div>

          {canManage ? (
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="primary-button flex items-center gap-2"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Organization Settings
              </button>
            </div>
          ) : (
            <p className="text-xs text-sentinel-muted italic">
              You have read-only access. Contact an Administrator to modify organization policies.
            </p>
          )}
        </form>
      </div>

      {/* Emergency Lockdown Mode */}
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-sentinel-text">Emergency Organization Killswitch</h4>
            <p className="text-xs text-sentinel-muted leading-relaxed">
              Instantly suspends all active AI agents across your organization and blocks all outgoing evaluated actions until disabled.
            </p>
            <div className="pt-3">
              <button
                type="button"
                onClick={() => alert("Emergency killswitch confirmation dialog.")}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-500/20 transition"
              >
                <Lock className="h-3.5 w-3.5" />
                Trigger Emergency Lockdown
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
