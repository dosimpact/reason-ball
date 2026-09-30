import { createHmac, timingSafeEqual } from "node:crypto";

export function signVideoOperation(input: { operation: string; ownerId: string; expiresAt: number }, secret: string) {
  const payload = Buffer.from(JSON.stringify(input)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function verifyVideoOperation(token: string, ownerId: string, now: number, secret: string): string | undefined {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || token.length > 2048) return undefined;
  const actual = Buffer.from(signature, "base64url");
  const expected = createHmac("sha256", secret).update(payload).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
  try {
    const input = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (input.ownerId !== ownerId || typeof input.expiresAt !== "number" || input.expiresAt <= now || typeof input.operation !== "string") return undefined;
    return input.operation;
  } catch { return undefined; }
}
