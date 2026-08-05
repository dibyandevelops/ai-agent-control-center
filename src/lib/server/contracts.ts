import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);

export const actionEvaluationSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  agent: z.object({
    externalId: z.string().min(2).max(128),
    name: z.string().min(2).max(160),
    ownerEmail: z.string().email(),
    team: z.string().min(2).max(120).default("Platform Engineering"),
    provider: z.string().min(2).max(80).default("Unknown"),
  }),
  action: z.string().min(2).max(160),
  resource: z.string().min(1).max(240),
  environment: z.enum(["development", "staging", "production"]),
  riskHint: riskLevelSchema.optional(),
  context: z
    .record(
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .default({}),
});

export const decisionSchema = z.object({
  decision: z.enum(["approved", "denied"]),
  reason: z.string().min(3).max(1_000),
});

export const releaseGovernanceRequestSchema = z.object({
  operation: z.enum(["publish", "cancel"]),
  reason: z.string().trim().min(3).max(1_000),
});

export const releaseGovernanceDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(3).max(1_000),
});

export const executionOutcomeSchema = z
  .object({
    status: z.enum(["executing", "succeeded", "failed", "cancelled"]),
    summary: z.string().trim().min(3).max(1_000),
    externalReference: z.string().trim().min(1).max(500).optional(),
    errorCode: z.string().trim().min(1).max(120).optional(),
  })
  .superRefine((input, context) => {
    if (input.errorCode && input.status !== "failed") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["errorCode"],
        message: "errorCode is only valid for a failed execution.",
      });
    }
  });

export const policyConditionSchema = z.object({
  field: z.string().min(1).max(120),
  operator: z.enum(["eq", "in", "gte", "contains"]),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
  ]),
});

export const policyConditionsSchema = z.object({
  all: z.array(policyConditionSchema).min(1),
});

export type ActionEvaluationInput = z.infer<typeof actionEvaluationSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
export type ExecutionOutcomeInput = z.infer<typeof executionOutcomeSchema>;
export type PolicyConditions = z.infer<typeof policyConditionsSchema>;
