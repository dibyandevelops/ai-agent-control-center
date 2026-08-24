import { z } from "zod";

export const policyFields = [
  "action",
  "resource",
  "environment",
  "risk",
  "context.recordCount",
  "context.amount",
  "context.destinationApproved",
  "context.changeTicket",
] as const;

export const policyOperators = ["eq", "in", "gte", "contains"] as const;

const allowedOperators: Record<
  (typeof policyFields)[number],
  ReadonlySet<(typeof policyOperators)[number]>
> = {
  action: new Set(["eq", "in", "contains"]),
  resource: new Set(["eq", "in", "contains"]),
  environment: new Set(["eq", "in"]),
  risk: new Set(["eq", "in"]),
  "context.recordCount": new Set(["eq", "gte"]),
  "context.amount": new Set(["eq", "gte"]),
  "context.destinationApproved": new Set(["eq"]),
  "context.changeTicket": new Set(["eq", "contains"]),
};

export const policyConditionInputSchema = z
  .object({
    field: z.enum(policyFields),
    operator: z.enum(policyOperators),
    value: z.union([
      z.string().min(1).max(240),
      z.number().finite(),
      z.boolean(),
      z.array(z.union([z.string().min(1).max(240), z.number(), z.boolean()])).min(1).max(20),
    ]),
  })
  .superRefine((condition, context) => {
    if (!allowedOperators[condition.field].has(condition.operator)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["operator"],
        message: `${condition.operator} is not supported for ${condition.field}.`,
      });
    }
    if (condition.operator === "gte" && typeof condition.value !== "number") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Greater-than-or-equal conditions require a number.",
      });
    }
    if (condition.operator === "in" && !Array.isArray(condition.value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "In conditions require a list of values.",
      });
    }
    if (
      condition.operator === "contains" &&
      typeof condition.value !== "string"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Contains conditions require text.",
      });
    }
    if (
      condition.field === "context.destinationApproved" &&
      typeof condition.value !== "boolean"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Destination approval must be true or false.",
      });
    }
    if (
      (condition.field === "context.recordCount" ||
        condition.field === "context.amount") &&
      typeof condition.value !== "number"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Numeric context fields require a number.",
      });
    }
  });

export const policyWriteSchema = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(500),
  priority: z.number().int().min(0).max(10_000),
  effect: z.enum(["allow", "approval", "block"]),
  enabled: z.boolean(),
  conditions: z.object({
    all: z.array(policyConditionInputSchema).min(1).max(6),
  }),
});

export const policySimulationInputSchema = policyWriteSchema
  .pick({
    name: true,
    priority: true,
    effect: true,
    conditions: true,
  })
  .extend({
    policyId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(25),
    environment: z.enum(["development", "staging", "production"]).optional(),
    syntheticAction: z
      .object({
        action: z.string().trim().min(1).max(120),
        resource: z.string().trim().min(1).max(160),
        environment: z.enum(["development", "staging", "production"]).default("production"),
        risk: z.enum(["low", "medium", "high"]).default("high"),
        context: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null()]),
          )
          .default({}),
      })
      .optional(),
  });

export const policyActivationDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(3).max(1_000),
});

export const policyRollbackSchema = z.object({
  versionId: z.string().uuid(),
});

export type PolicyWriteInput = z.infer<typeof policyWriteSchema>;
