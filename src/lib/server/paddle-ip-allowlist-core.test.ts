import { describe, expect, it } from "vitest";
import { getForwardedIpv4, isIpv4InCidrs } from "./paddle-ip-allowlist-core";

describe("Paddle webhook IP allowlist", () => {
  it("matches IPv4 addresses to CIDR ranges", () => {
    expect(isIpv4InCidrs("34.194.127.46", ["34.194.127.46/32"])).toBe(true);
    expect(isIpv4InCidrs("10.1.2.3", ["10.1.0.0/16"])).toBe(true);
    expect(isIpv4InCidrs("10.2.2.3", ["10.1.0.0/16"])).toBe(false);
  });

  it("rejects malformed addresses and CIDRs", () => {
    expect(isIpv4InCidrs("999.1.2.3", ["999.1.2.3/32"])).toBe(false);
    expect(isIpv4InCidrs("34.194.127.46", ["34.194.127.46/35"])).toBe(false);
    expect(isIpv4InCidrs("::1", ["0.0.0.0/0"])).toBe(false);
  });

  it("reads only the first forwarded IP and rejects invalid values", () => {
    expect(getForwardedIpv4(new Headers({ "x-forwarded-for": "34.194.127.46, 10.0.0.1" }))).toBe("34.194.127.46");
    expect(getForwardedIpv4(new Headers({ "x-forwarded-for": "not-an-ip" }))).toBeNull();
    expect(getForwardedIpv4(new Headers())).toBeNull();
  });
});
