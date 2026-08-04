import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const keyLength = 64;
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;
const maxmem = 64 * 1024 * 1024;

export function generateTemporaryPassword() {
  return `sos_tmp_${randomBytes(24).toString("base64url")}`;
}

function derivePasswordKey(
  password: string,
  salt: Buffer,
  parameters: { N: number; r: number; p: number },
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      { ...parameters, maxmem },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derivePasswordKey(password, salt, {
    N: cost,
    r: blockSize,
    p: parallelization,
  });
  return [
    "scrypt",
    cost,
    blockSize,
    parallelization,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, costValue, blockValue, parallelValue, saltValue, hashValue] =
    encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !costValue ||
    !blockValue ||
    !parallelValue ||
    !saltValue ||
    !hashValue
  ) {
    return false;
  }

  const expected = Buffer.from(hashValue, "base64url");
  if (expected.length !== keyLength) return false;
  const actual = await derivePasswordKey(
    password,
    Buffer.from(saltValue, "base64url"),
    {
      N: Number(costValue),
      r: Number(blockValue),
      p: Number(parallelValue),
    },
  );
  return timingSafeEqual(actual, expected);
}
