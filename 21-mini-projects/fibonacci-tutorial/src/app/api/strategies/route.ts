import { createStrategy, listStrategyViews } from "@/server/strategies/service";
import { strategyBody, strategyErrorResponse } from "@/server/strategies/http";

export async function GET(): Promise<Response> {
  try { return Response.json(await listStrategyViews()); } catch (error) { return strategyErrorResponse(error); }
}
export async function POST(request: Request): Promise<Response> {
  try { return Response.json(await createStrategy(await strategyBody(request)), { status: 201 }); }
  catch (error) { return strategyErrorResponse(error); }
}
