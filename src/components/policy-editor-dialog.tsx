"use client";

import {
  Activity,
  Check,
  ClipboardCheck,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  PolicySimulationPanel,
  type PolicySimulationDraft,
} from "@/components/policy-simulation-panel";
import type { Policy } from "@/lib/types";

type PolicyField =
  | "action"
  | "resource"
  | "environment"
  | "risk"
  | "context.recordCount"
  | "context.amount"
  | "context.destinationApproved"
  | "context.changeTicket";
type PolicyOperator = "eq" | "in" | "gte" | "contains";
type PolicyEffect = "block" | "approval" | "allow";

interface DraftCondition {
  field: PolicyField;
  operator: PolicyOperator;
  value: string;
}
const fieldOptions: Array<{
  value: PolicyField;
  label: string;
  operators: PolicyOperator[];
  valueType: "text" | "number" | "boolean";
}> = [
  { value: "action", label: "Action", operators: ["eq", "in", "contains"], valueType: "text" },
  { value: "resource", label: "Resource", operators: ["eq", "in", "contains"], valueType: "text" },
  { value: "environment", label: "Environment", operators: ["eq", "in"], valueType: "text" },
  { value: "risk", label: "Resolved risk", operators: ["eq", "in"], valueType: "text" },
  { value: "context.recordCount", label: "Record count", operators: ["eq", "gte"], valueType: "number" },
  { value: "context.amount", label: "Amount", operators: ["eq", "gte"], valueType: "number" },
  { value: "context.destinationApproved", label: "Destination approved", operators: ["eq"], valueType: "boolean" },
  { value: "context.changeTicket", label: "Change ticket", operators: ["eq", "contains"], valueType: "text" },
];

const operatorLabels: Record<PolicyOperator, string> = {
  eq: "equals",
  in: "is one of",
  gte: "is at least",
  contains: "contains",
};

const inputClass =
  "h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3 text-xs text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

function initialConditions(policy: Policy | null): DraftCondition[] {
  if (!policy?.conditions?.length) {
    return [{ field: "environment", operator: "eq", value: "production" }];
  }
  return policy.conditions.map((condition) => ({
    field: condition.field as PolicyField,
    operator: condition.operator,
    value: Array.isArray(condition.value)
      ? condition.value.join(", ")
      : String(condition.value),
  }));
}

function initialEffect(policy: Policy | null): PolicyEffect {
  if (policy?.effect) return policy.effect;
  if (policy?.mode === "Block") return "block";
  if (policy?.mode === "Approval") return "approval";
  return "allow";
}

function conditionValue(condition: DraftCondition) {
  const field = fieldOptions.find((option) => option.value === condition.field);
  if (field?.valueType === "number") return Number(condition.value);
  if (field?.valueType === "boolean") return condition.value === "true";
  if (condition.operator === "in") {
    return condition.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return condition.value.trim();
}

function serializeConditions(conditions: DraftCondition[]) {
  return conditions.map((condition) => ({
    field: condition.field,
    operator: condition.operator,
    value: conditionValue(condition),
  }));
}

function conditionsAreComplete(conditions: ReturnType<typeof serializeConditions>) {
  return !conditions.some(
    (condition) =>
      (typeof condition.value === "number" && Number.isNaN(condition.value)) ||
      (Array.isArray(condition.value) && condition.value.length === 0) ||
      condition.value === "",
  );
}

function effectLabel(effect: PolicyEffect) {
  if (effect === "block") return "Block the action";
  if (effect === "approval") return "Require human approval";
  return "Allow and monitor";
}

export function PolicyEditorDialog({
  policy,
  onClose,
  onSaved,
}: {
  policy: Policy | null;
  onClose: () => void;
  onSaved: (policy: Policy) => void;
}) {
  const [name, setName] = useState(policy?.name ?? "");
  const [description, setDescription] = useState(policy?.description ?? "");
  const [priority, setPriority] = useState(String(policy?.priority ?? 100));
  const [effect, setEffect] = useState<PolicyEffect>(() => initialEffect(policy));
  const [enabled, setEnabled] = useState(policy?.enabled ?? false);
  const [conditions, setConditions] = useState<DraftCondition[]>(() =>
    initialConditions(policy),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateCondition(index: number, update: Partial<DraftCondition>) {
    setConditions((current) =>
      current.map((condition, conditionIndex) => {
        if (conditionIndex !== index) return condition;
        if (!update.field) return { ...condition, ...update };
        const nextField = fieldOptions.find((field) => field.value === update.field)!;
        return {
          field: update.field,
          operator: nextField.operators[0],
          value: nextField.valueType === "boolean" ? "false" : "",
        };
      }),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const serializedConditions = serializeConditions(conditions);
      if (!conditionsAreComplete(serializedConditions)) {
        throw new Error("Complete every condition with a valid value.");
      }
      const response = await fetch(
        policy ? `/api/v1/policies/${policy.id}` : "/api/v1/policies",
        {
          method: policy ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            priority: Number(priority),
            effect,
            enabled,
            conditions: { all: serializedConditions },
          }),
        },
      );
      const payload = (await response.json()) as Policy & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Policy could not be saved.");
      }
      onSaved({ ...payload, matches: payload.matches ?? policy?.matches ?? 0 });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Policy could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  const EffectIcon = effect === "block" ? LockKeyhole : effect === "approval" ? ClipboardCheck : Activity;
  const serializedConditions = serializeConditions(conditions);
  const numericPriority = Number(priority);
  const simulationDraft: PolicySimulationDraft | null =
    name.trim().length >= 3 &&
    Number.isInteger(numericPriority) &&
    numericPriority >= 0 &&
    numericPriority <= 10_000 &&
    conditionsAreComplete(serializedConditions)
      ? {
          policyId: policy?.id,
          name: name.trim(),
          priority: numericPriority,
          effect,
          conditions: { all: serializedConditions },
        }
      : null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-x-hidden overflow-y-auto rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2" role="dialog" aria-modal="true" aria-labelledby="policy-editor-title">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-sentinel-line bg-sentinel-surface/95 px-4 sm:px-6 py-4 sm:py-5 backdrop-blur">
          <div>
            <h2 id="policy-editor-title" className="text-base sm:text-lg font-semibold tracking-tight text-sentinel-text">{policy ? "Edit policy" : "Create enforcement policy"}</h2>
            <p className="mt-1 text-[11px] sm:text-xs leading-4 sm:leading-5 text-sentinel-muted">All conditions must match before SentinelOps applies the decision.</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text" onClick={onClose} aria-label="Close policy editor"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="grid min-w-0 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="min-w-0 space-y-5 sm:space-y-6 px-4 sm:px-6 py-4 sm:py-6 lg:border-r lg:border-sentinel-line">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-[1fr_130px]">
              <label className="text-xs font-medium text-sentinel-muted">Policy name<input className={`${inputClass} mt-1.5 sm:mt-2`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Production changes require approval" required minLength={3} maxLength={160} autoFocus /></label>
              <label className="text-xs font-medium text-sentinel-muted">Priority<input className={`${inputClass} mt-1.5 sm:mt-2`} type="number" min={0} max={10000} value={priority} onChange={(event) => setPriority(event.target.value)} required /></label>
            </div>
            <label className="block text-xs font-medium text-sentinel-muted">Description<textarea className="mt-1.5 sm:mt-2 min-h-20 w-full resize-y rounded-xl border border-sentinel-line bg-sentinel-canvas px-3 py-2.5 text-xs leading-5 text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the business control and why it exists." required minLength={10} maxLength={500} /></label>

            <fieldset>
              <legend className="text-xs font-medium text-sentinel-muted">When every condition matches</legend>
              <div className="mt-3 space-y-3">
                {conditions.map((condition, index) => {
                  const field = fieldOptions.find((option) => option.value === condition.field)!;
                  return (
                    <div className="grid gap-2 rounded-xl border border-sentinel-line bg-sentinel-raised/45 p-3 grid-cols-[1fr_auto] sm:grid-cols-[1fr_130px_1fr_36px] items-center" key={`${index}-${condition.field}`}>
                      <select className={`${inputClass} col-span-1`} aria-label={`Field for condition ${index + 1}`} value={condition.field} onChange={(event) => updateCondition(index, { field: event.target.value as PolicyField })}>{fieldOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                      <button type="button" className="grid h-10 w-9 place-items-center rounded-xl border border-sentinel-line text-sentinel-muted transition hover:border-sentinel-red/30 hover:text-red-300 disabled:opacity-30 sm:order-last" onClick={() => setConditions((current) => current.filter((_, conditionIndex) => conditionIndex !== index))} disabled={conditions.length === 1} aria-label={`Remove condition ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      <select className={`${inputClass} col-span-2 sm:col-span-1`} aria-label={`Operator for condition ${index + 1}`} value={condition.operator} onChange={(event) => updateCondition(index, { operator: event.target.value as PolicyOperator })}>{field.operators.map((operator) => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}</select>
                      {field.valueType === "boolean" ? (
                        <select className={`${inputClass} col-span-2 sm:col-span-1`} aria-label={`Value for condition ${index + 1}`} value={condition.value} onChange={(event) => updateCondition(index, { value: event.target.value })}><option value="false">False</option><option value="true">True</option></select>
                      ) : (
                        <input className={`${inputClass} col-span-2 sm:col-span-1`} type={field.valueType === "number" ? "number" : "text"} aria-label={`Value for condition ${index + 1}`} value={condition.value} onChange={(event) => updateCondition(index, { value: event.target.value })} placeholder={condition.operator === "in" ? "value1, value2" : field.valueType === "number" ? "1000" : "deploy.release"} required />
                      )}
                    </div>
                  );
                })}
              </div>
              <button type="button" className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-sentinel-line px-3 text-xs font-semibold text-sentinel-muted transition hover:text-sentinel-text disabled:opacity-40" onClick={() => setConditions((current) => [...current, { field: "action", operator: "eq", value: "" }])} disabled={conditions.length >= 6}><Plus className="h-3.5 w-3.5" /> Add condition</button>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-medium text-sentinel-muted">Then SentinelOps should</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(["block", "approval", "allow"] as PolicyEffect[]).map((option) => (
                  <button type="button" key={option} className={`rounded-xl border px-3 py-3 text-left transition ${effect === option ? "border-sentinel-lime/50 bg-sentinel-lime/10" : "border-sentinel-line bg-sentinel-raised/40 hover:border-sentinel-line-strong"}`} onClick={() => setEffect(option)} aria-pressed={effect === option}>
                    <strong className="block text-xs font-semibold text-sentinel-text">{effectLabel(option)}</strong>
                    <span className="mt-1 block text-[10px] text-sentinel-muted">{option === "block" ? "Stop immediately" : option === "approval" ? "Pause for review" : "Record and continue"}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <PolicySimulationPanel draft={simulationDraft} />

            <label className="flex items-center justify-between gap-4 rounded-xl border border-sentinel-line bg-sentinel-raised/40 px-4 py-3">
              <span><strong className="block text-xs font-semibold text-sentinel-text">Request activation after saving</strong><small className="mt-1 block text-[10px] text-sentinel-muted">A different administrator must approve before enforcement changes.</small></span>
              <input className="h-4 w-4 accent-sentinel-lime" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            </label>
          </div>

          <aside className="min-w-0 bg-sentinel-canvas/35 px-6 py-6">
            <div className="sticky top-24">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sentinel-dim">Decision preview</span>
              <div className="mt-3 rounded-xl border border-sentinel-line bg-sentinel-raised/50 p-4">
                <span className={`grid h-10 w-10 place-items-center rounded-xl border ${effect === "block" ? "border-sentinel-red/30 bg-sentinel-red/10 text-red-300" : effect === "approval" ? "border-sentinel-amber/30 bg-sentinel-amber/10 text-sentinel-amber" : "border-sentinel-lime/25 bg-sentinel-lime/10 text-sentinel-lime"}`}><EffectIcon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-sm font-semibold text-sentinel-text">{name || "Untitled policy"}</h3>
                <p className="mt-1 text-xs leading-5 text-sentinel-muted">{description || "Describe the control this policy enforces."}</p>
                <div className="my-4 h-px bg-sentinel-line" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sentinel-dim">When</p>
                <ol className="mt-2 space-y-2">
                  {conditions.map((condition, index) => (
                    <li className="flex gap-2 text-xs leading-5 text-sentinel-muted" key={`${condition.field}-${index}`}><span className="font-mono text-sentinel-lime">{index + 1}.</span><span><strong className="font-medium text-sentinel-text">{fieldOptions.find((field) => field.value === condition.field)?.label}</strong> {operatorLabels[condition.operator]} <code className="text-sentinel-text">{condition.value || "…"}</code></span></li>
                  ))}
                </ol>
                <div className="my-4 h-px bg-sentinel-line" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sentinel-dim">Decision</p>
                <strong className="mt-2 flex items-center gap-2 text-xs text-sentinel-text"><Check className="h-3.5 w-3.5 text-sentinel-lime" /> {effectLabel(effect)}</strong>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-sentinel-line px-3 py-2.5 text-[10px] leading-4 text-sentinel-muted"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentinel-lime" /> Lower priority numbers run first. The first matching policy determines the action.</div>
            </div>
          </aside>

          <div className="sticky bottom-0 flex min-w-0 items-center justify-between gap-3 border-t border-sentinel-line bg-sentinel-surface/95 px-6 py-4 backdrop-blur lg:col-span-2">
            <span className="hidden text-[10px] text-sentinel-muted sm:block">{enabled ? "This version will wait for independent approval." : "This version will be saved as a draft."}</span>
            <div className="ml-auto flex gap-3"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}{submitting ? "Saving…" : enabled ? "Save & request approval" : "Save draft"}</button></div>
          </div>
          {error ? <div className="border-t border-sentinel-red/30 bg-sentinel-red/10 px-6 py-3 text-xs text-red-200 lg:col-span-2">{error}</div> : null}
        </form>
      </div>
    </div>
  );
}
