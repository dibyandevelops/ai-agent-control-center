import { createHash, randomBytes } from "node:crypto";

export function createPasswordResetToken() {
  const token = `sop_reset_${randomBytes(32).toString("base64url")}`;
  return {
    token,
    hash: hashPasswordResetToken(token),
  };
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
