import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

function base64Url(value: Buffer): string {
  return value.toString("base64url");
}

export function randomUrlSafe(bytes = 32): string {
  return base64Url(randomBytes(bytes));
}

export function createPkcePair(verifier = randomUrlSafe(32)) {
  return {
    verifier,
    challenge: base64Url(createHash("sha256").update(verifier, "ascii").digest()),
    method: "S256" as const,
  };
}

export function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
