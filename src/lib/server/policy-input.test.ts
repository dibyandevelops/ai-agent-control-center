import { describe, expect, it } from "vitest";
import { policyWriteSchema } from "./policy-input";

const validPolicy = {
  name: "Large exports require approval",
  description: "Routes large exports to a human reviewer before execution.",
  priority: 40,
  effect: "approval" as const,
  enabled: false,
  conditions: {
    all: [
      { field: "context.recordCount" as const, operator: "gte" as const, value: 1000 },
    ],
  },
};

describe("policy authoring contract", () => {
  it("accepts a valid policy draft", () => {
    expect(policyWriteSchema.parse(validPolicy)).toEqual(validPolicy);
  });

  it("rejects incompatible fields, operators, and values", () => {
    expect(() =>
      policyWriteSchema.parse({
        ...validPolicy,
        conditions: {
          all: [{ field: "environment", operator: "gte", value: 3 }],
        },
      }),
    ).toThrow();
    expect(() =>
      policyWriteSchema.parse({
        ...validPolicy,
        conditions: {
          all: [{ field: "context.amount", operator: "gte", value: "1000" }],
        },
      }),
    ).toThrow();
  });

  it("limits policy complexity for predictable evaluation", () => {
    expect(() =>
      policyWriteSchema.parse({
        ...validPolicy,
        conditions: { all: [] },
      }),
    ).toThrow();
  });
});
