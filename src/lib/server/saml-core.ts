import { createHash, randomBytes, X509Certificate } from "node:crypto";

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

export function parseSamlCertificateExpiry(pemCertificate: string): Date | null {
  try {
    const cert = new X509Certificate(normalizeSamlCertificate(pemCertificate));
    return new Date(cert.validTo);
  } catch {
    return null;
  }
}

export interface ParsedIdpMetadata {
  entityId: string;
  entryPoint: string;
  certificate: string;
  certExpiresAt: Date | null;
}

export function formatX509Pem(rawBase64: string): string {
  const clean = rawBase64.replace(/\s+/g, "");
  if (!clean) throw new Error("Certificate data is empty.");
  if (clean.includes("-----BEGIN CERTIFICATE-----")) {
    return normalizeSamlCertificate(clean);
  }
  const lines = clean.match(/.{1,64}/g) ?? [clean];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
}

export function parseSamlIdpMetadataXml(xml: string): ParsedIdpMetadata {
  const trimmed = xml.trim();
  if (!trimmed || (!trimmed.includes("EntityDescriptor") && !trimmed.includes("IDPSSODescriptor"))) {
    throw new Error("Invalid SAML metadata: EntityDescriptor or IDPSSODescriptor element not found.");
  }

  // Extract entityID
  const entityIdMatch = trimmed.match(/<(?:\w+:)?EntityDescriptor[^>]*\bentityID=["']([^"']+)["']/i);
  if (!entityIdMatch || !entityIdMatch[1]) {
    throw new Error("Invalid SAML metadata: entityID attribute not found.");
  }
  const entityId = entityIdMatch[1].trim();

  // Extract SingleSignOnService Location (prefer HTTP-Redirect, fallback to HTTP-POST, or any Location)
  let entryPoint: string | null = null;
  const ssoMatches = [
    ...trimmed.matchAll(/<(?:\w+:)?SingleSignOnService[^>]*\bBinding=["']([^"']+)["'][^>]*\bLocation=["']([^"']+)["']/gi),
    ...trimmed.matchAll(/<(?:\w+:)?SingleSignOnService[^>]*\bLocation=["']([^"']+)["'][^>]*\bBinding=["']([^"']+)["']/gi),
  ];

  for (const match of ssoMatches) {
    const isFirstBinding = match[0].indexOf("Binding") < match[0].indexOf("Location");
    const binding = isFirstBinding ? match[1] : match[2];
    const location = isFirstBinding ? match[2] : match[1];
    if (location) {
      if (binding && binding.includes("HTTP-Redirect")) {
        entryPoint = location.trim();
        break;
      }
      if (!entryPoint) {
        entryPoint = location.trim();
      }
    }
  }

  if (!entryPoint) {
    const fallbackSsoMatch = trimmed.match(/<(?:\w+:)?SingleSignOnService[^>]*\bLocation=["']([^"']+)["']/i);
    if (fallbackSsoMatch && fallbackSsoMatch[1]) {
      entryPoint = fallbackSsoMatch[1].trim();
    }
  }

  if (!entryPoint) {
    throw new Error("Invalid SAML metadata: SingleSignOnService endpoint location not found.");
  }

  try {
    const parsedUrl = new URL(entryPoint);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("SingleSignOnService location must be a valid URL.");
    }
  } catch {
    throw new Error("Invalid SingleSignOnService URL in SAML metadata.");
  }

  // Extract X509Certificate (prefer signing key descriptor if present)
  let rawCert: string | null = null;
  const signingKeyMatch = trimmed.match(/<(?:\w+:)?KeyDescriptor[^>]*\buse=["']signing["'][^>]*>[\s\S]*?<(?:\w+:)?X509Certificate>([^<]+)<\/(?:\w+:)?X509Certificate>[\s\S]*?<\/(?:\w+:)?KeyDescriptor>/i);
  if (signingKeyMatch && signingKeyMatch[1]) {
    rawCert = signingKeyMatch[1];
  } else {
    const certMatch = trimmed.match(/<(?:\w+:)?X509Certificate>([^<]+)<\/(?:\w+:)?X509Certificate>/i);
    if (certMatch && certMatch[1]) {
      rawCert = certMatch[1];
    }
  }

  if (!rawCert) {
    throw new Error("Invalid SAML metadata: X509Certificate signing certificate not found.");
  }

  const certificate = formatX509Pem(rawCert);
  const certExpiresAt = parseSamlCertificateExpiry(certificate);

  return {
    entityId,
    entryPoint,
    certificate,
    certExpiresAt,
  };
}
