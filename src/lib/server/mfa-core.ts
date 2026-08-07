import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function createTotpSecret() {
  return Array.from(randomBytes(20), (byte) => alphabet[byte % alphabet.length]).join("");
}

function decodeBase32(value: string) {
  let bits = "";
  for (const char of value.replace(/=|\s/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Invalid authenticator secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function totpCode(secret: string, at = Date.now()) {
  const counter = Math.floor(at / 30_000);
  const input = Buffer.alloc(8); input.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(input).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(value % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s|-/g, "");
  return /^\d{6}$/.test(normalized) && [-30_000, 0, 30_000].some((offset) => totpCode(secret, now + offset) === normalized);
}

function key(encoded: string) { const decoded = Buffer.from(encoded, "base64"); if (decoded.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key."); return decoded; }
export function encryptMfaSecret(secret: string, encodedKey: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(encodedKey), iv); const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]); return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") }; }
export function decryptMfaSecret(value: { ciphertext: string; iv: string; tag: string }, encodedKey: string) { const decipher = createDecipheriv("aes-256-gcm", key(encodedKey), Buffer.from(value.iv, "base64")); decipher.setAuthTag(Buffer.from(value.tag, "base64")); return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8"); }
export function createRecoveryCodes() { return Array.from({ length: 8 }, () => `${randomBytes(4).toString("hex").slice(0, 4)}-${randomBytes(4).toString("hex").slice(0, 4)}`); }
export function hashRecoveryCode(code: string) { return createHash("sha256").update(code.replace(/\s|-/g, "").toLowerCase()).digest("hex"); }
