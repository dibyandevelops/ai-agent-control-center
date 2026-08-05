import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGitHubAppJwt } from "./github-app-core";

describe("GitHub App authentication", () => {
  it("creates a short-lived RS256 app JWT", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const now = new Date("2026-08-05T10:00:00.000Z");
    const token = createGitHubAppJwt({ appId: "123456", privateKey, now });
    const [header, payload, signature] = token.split(".");
    const decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString());
    const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString());
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    verifier.end();

    expect(decodedHeader).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decodedPayload).toEqual({
      iat: Math.floor(now.getTime() / 1000) - 60,
      exp: Math.floor(now.getTime() / 1000) + 540,
      iss: "123456",
    });
    expect(verifier.verify(publicKey, signature, "base64url")).toBe(true);
  });
});
