import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EncryptedSlackCredential {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

function encryptionKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("SLACK_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptSlackWebhook(
  webhookUrl: string,
  encodedKey: string,
): EncryptedSlackCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(webhookUrl, "utf8"),
    cipher.final(),
  ]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptSlackWebhook(
  encrypted: EncryptedSlackCredential,
  encodedKey: string,
) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(encodedKey),
    encrypted.iv,
  );
  decipher.setAuthTag(encrypted.authTag);
  return Buffer.concat([
    decipher.update(encrypted.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
