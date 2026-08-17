import { describe, expect, it } from "vitest";
import {
  createInvitationToken,
  getInvitationStatus,
  hashInvitationToken,
} from "./invitations-core";

describe("invitations core", () => {
  it("generates structured token and deterministic hash", () => {
    const { token, hash } = createInvitationToken();
    expect(token).toMatch(/^sop_inv_[A-Za-z0-9_-]{40,}$/);
    expect(hash).toHaveLength(64);
    expect(hashInvitationToken(token)).toBe(hash);
  });

  it("calculates status based on accepted, revoked, and expiry dates", () => {
    const future = new Date(Date.now() + 86400000);
    const past = new Date(Date.now() - 86400000);

    expect(
      getInvitationStatus({
        accepted_at: null,
        revoked_at: null,
        expires_at: future,
      }),
    ).toBe("pending");

    expect(
      getInvitationStatus({
        accepted_at: new Date(),
        revoked_at: null,
        expires_at: future,
      }),
    ).toBe("accepted");

    expect(
      getInvitationStatus({
        accepted_at: null,
        revoked_at: new Date(),
        expires_at: future,
      }),
    ).toBe("revoked");

    expect(
      getInvitationStatus({
        accepted_at: null,
        revoked_at: null,
        expires_at: past,
      }),
    ).toBe("expired");
  });
});
