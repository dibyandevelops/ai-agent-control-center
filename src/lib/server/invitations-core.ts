import { createHash, randomBytes } from "node:crypto";

export function createInvitationToken() {
  const token = `sop_inv_${randomBytes(32).toString("base64url")}`;
  return {
    token,
    hash: hashInvitationToken(token),
  };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export function getInvitationStatus(invitation: {
  accepted_at: Date | string | null;
  revoked_at: Date | string | null;
  expires_at: Date | string;
}): InvitationStatus {
  if (invitation.accepted_at) return "accepted";
  if (invitation.revoked_at) return "revoked";
  const expiry = new Date(invitation.expires_at).getTime();
  if (expiry <= Date.now()) return "expired";
  return "pending";
}
