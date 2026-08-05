import { createSign } from "node:crypto";

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function createGitHubAppJwt(input: {
  appId: string;
  privateKey: string;
  now?: Date;
}) {
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: input.appId,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(input.privateKey, "base64url")}`;
}
