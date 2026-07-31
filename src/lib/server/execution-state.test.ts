import { describe, expect, it } from "vitest";
import { evaluateExecutionTransition } from "./execution-state";

describe("execution outcome transitions", () => {
  it.each(["executing", "succeeded", "failed", "cancelled"] as const)(
    "allows not_started to transition to %s",
    (status) => {
      expect(evaluateExecutionTransition("not_started", status)).toBe(
        "transition",
      );
    },
  );

  it.each(["succeeded", "failed", "cancelled"] as const)(
    "allows executing to transition to %s",
    (status) => {
      expect(evaluateExecutionTransition("executing", status)).toBe(
        "transition",
      );
    },
  );

  it("treats the same status as an idempotent replay", () => {
    expect(evaluateExecutionTransition("executing", "executing")).toBe(
      "replay",
    );
    expect(evaluateExecutionTransition("succeeded", "succeeded")).toBe(
      "replay",
    );
  });

  it.each([
    ["succeeded", "failed"],
    ["failed", "succeeded"],
    ["cancelled", "executing"],
  ] as const)("rejects a terminal rewrite from %s to %s", (current, next) => {
    expect(evaluateExecutionTransition(current, next)).toBe("conflict");
  });
});
