import { describe, expect, it } from "vitest";
import {
  getQuickstartSnippet,
  quickstartLanguages,
} from "./agent-quickstart";

describe("agent quickstart snippets", () => {
  it("provides dependency-free examples for every supported language", () => {
    expect(quickstartLanguages.map((language) => language.id)).toEqual([
      "curl",
      "node",
      "python",
    ]);
    for (const language of quickstartLanguages) {
      const snippet = getQuickstartSnippet(language.id);
      expect(snippet).toContain("/api/v1/actions/evaluate");
      expect(snippet).toContain("SENTINELOPS_AGENT_API_KEY");
      expect(snippet).toContain("invoice.payment.prepare");
      expect(snippet).not.toMatch(/sop_live_[A-Za-z0-9_-]+/);
    }
  });

  it("uses only Python standard-library modules", () => {
    const snippet = getQuickstartSnippet("python");
    expect(snippet).toContain("import urllib.request");
    expect(snippet).not.toContain("requests");
  });
});

