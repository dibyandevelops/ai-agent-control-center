import { createHash, randomBytes } from "node:crypto";

export function createSamlRelayState() {
  return randomBytes(32).toString("base64url");
}

export function hashSamlRelayState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeSamlCertificate(value: string) {
  const certificate = value.trim().replace(/\r\n/g, "\n");
  if (!certificate.includes("-----BEGIN CERTIFICATE-----") || !certificate.includes("-----END CERTIFICATE-----")) {
    throw new Error("Paste the IdP X.509 signing certificate in PEM format.");
  }
  return certificate;
}
