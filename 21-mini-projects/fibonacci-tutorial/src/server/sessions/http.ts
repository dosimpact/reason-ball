import "server-only";
import { z } from "zod";
import { SessionError } from "./service";
import { MarketDataError } from "@/server/candle-data/binance";

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new SessionError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new SessionError(400, "VALIDATION_ERROR", z.prettifyError(parsed.error));
  }
  return parsed.data;
}

export function respondToError(error: unknown): Response {
  if (error instanceof MarketDataError) {
    return Response.json({ error: { code: "UPSTREAM_ERROR", message: error.message } }, { status: error.status });
  }
  if (error instanceof SessionError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  throw error;
}
