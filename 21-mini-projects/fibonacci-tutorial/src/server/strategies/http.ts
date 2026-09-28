import "server-only";
import { z } from "zod";
import { MarketDataError } from "@/server/candle-data/binance";
import { StrategyError } from "./service";

export async function strategyBody(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new StrategyError(400, "VALIDATION_ERROR", "Request body must be valid JSON."); }
}
export function strategyErrorResponse(error: unknown): Response {
  if (error instanceof StrategyError || error instanceof MarketDataError) {
    return Response.json({ error: { code: error instanceof StrategyError ? error.code : "UPSTREAM_ERROR", message: error.message } }, { status: error.status });
  }
  if (error instanceof z.ZodError) return Response.json({ error: { code: "VALIDATION_ERROR", message: z.prettifyError(error) } }, { status: 400 });
  throw error;
}
