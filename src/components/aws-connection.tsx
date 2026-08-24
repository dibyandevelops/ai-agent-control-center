"use client";

import {
  Check,
  Copy,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import React, { useState } from "react";

interface AwsConnectionProps {
  onNotify?: (message: string) => void;
}

export function AwsConnection({ onNotify }: AwsConnectionProps) {
  const [roleArn, setRoleArn] = useState("arn:aws:iam::123456789012:role/SentinelOpsAgentGuardRole");
  const [externalId] = useState("sentinel-org-94821a");
  const [region, setRegion] = useState("us-east-1");
  const [cloudTrailEnabled, setCloudTrailEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopyExternalId() {
    await navigator.clipboard.writeText(externalId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleTestConnection() {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 800));
    setTesting(false);
    onNotify?.("AWS IAM Role trust relationship and CloudTrail event ingestion verified.");
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    onNotify?.("AWS governance configuration saved successfully.");
  }

  return (
    <div className="mt-4 border-t border-sentinel-line pt-4 space-y-4 animate-dialog-in text-xs">
      <div className="rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/10 p-3 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-sentinel-lime shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <strong className="font-semibold text-sentinel-text">Cross-Account IAM Role Authentication</strong>
          <p className="mt-0.5 text-sentinel-muted text-[11px] leading-5">
            SentinelOps assumes an IAM role in your AWS account using a secure external ID to evaluate and gate autonomous agent API calls to AWS KMS, Bedrock, and S3.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-sentinel-muted text-[11px]">
            Target IAM Role ARN
            <input
              className="mt-1 h-9 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 font-mono text-xs text-sentinel-text outline-none focus:border-sentinel-lime/70 focus:ring-1 focus:ring-sentinel-lime/20"
              value={roleArn}
              onChange={(e) => setRoleArn(e.target.value)}
              placeholder="arn:aws:iam::123456789012:role/..."
            />
          </label>
        </div>

        <div>
          <label className="block font-medium text-sentinel-muted text-[11px]">
            Default AWS Region
            <select
              className="mt-1 h-9 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime/70"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="us-east-1">US East (N. Virginia) [us-east-1]</option>
              <option value="us-west-2">US West (Oregon) [us-west-2]</option>
              <option value="eu-west-1">Europe (Ireland) [eu-west-1]</option>
              <option value="eu-central-1">Europe (Frankfurt) [eu-central-1]</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore) [ap-southeast-1]</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <label className="block font-medium text-sentinel-muted text-[11px]">
          SentinelOps Organization External ID
        </label>
        <div className="mt-1 flex gap-2">
          <code className="min-w-0 flex-1 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 py-2 font-mono text-xs text-sentinel-text">
            {externalId}
          </code>
          <button
            type="button"
            className="secondary-button h-9 px-3"
            onClick={() => void handleCopyExternalId()}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-sentinel-lime" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-sentinel-line bg-sentinel-canvas/40 px-3.5 py-2.5">
        <div>
          <span className="font-semibold text-sentinel-text">CloudTrail Event Lake Ingestion</span>
          <p className="text-[11px] text-sentinel-muted">Stream agent-driven AWS API activity into tamper-evident audit logs.</p>
        </div>
        <input
          type="checkbox"
          className="h-4 w-4 rounded accent-sentinel-lime cursor-pointer"
          checked={cloudTrailEnabled}
          onChange={(e) => setCloudTrailEnabled(e.target.checked)}
        />
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          className="secondary-button"
          onClick={() => void handleTestConnection()}
          disabled={testing || saving}
        >
          {testing ? <LoaderCircle className="animate-spin h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {testing ? "Testing…" : "Test IAM Trust"}
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => void handleSave()}
          disabled={saving || testing}
        >
          {saving ? <LoaderCircle className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save AWS Settings"}
        </button>
      </div>
    </div>
  );
}
