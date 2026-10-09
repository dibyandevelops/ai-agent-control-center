function ipv4ToNumber(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    result = (result << 8) | octet;
  }
  return result >>> 0;
}

export function isIpv4InCidrs(address: string, cidrs: string[]): boolean {
  const ip = ipv4ToNumber(address);
  if (ip === null) return false;

  return cidrs.some((cidr) => {
    const [networkText, prefixText, extra] = cidr.split("/");
    if (!networkText || !prefixText || extra !== undefined || !/^\d{1,2}$/.test(prefixText)) return false;
    const prefix = Number(prefixText);
    const network = ipv4ToNumber(networkText);
    if (network === null || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return ((ip & mask) >>> 0) === ((network & mask) >>> 0);
  });
}

export function getForwardedIpv4(headers: Headers): string | null {
  // Vercel overwrites x-forwarded-for at its edge with the incoming client IP.
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && ipv4ToNumber(forwarded) !== null ? forwarded : null;
}
