import { describe, expect, it } from "vitest";
import { slackAuthorizeUrl } from "./slack-oauth-core";

describe("Slack OAuth authorization", () => {
  it("requests only an incoming webhook and binds the callback state", () => {
    const url = new URL(
      slackAuthorizeUrl({
        clientId: "123456.789",
        redirectUri: "https://sentinelops.example/api/v1/slack/connections/callback",
        state: "state-value",
      }),
    );

    expect(url.origin).toBe("https://slack.com");
    expect(url.pathname).toBe("/oauth/v2/authorize");
    expect(url.searchParams.get("scope")).toBe("incoming-webhook");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://sentinelops.example/api/v1/slack/connections/callback",
    );
  });
});
