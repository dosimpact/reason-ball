import { getStrategyView, updateStrategyDraft } from "@/server/strategies/service";
import { strategyBody, strategyErrorResponse } from "@/server/strategies/http";
type Context = { params: Promise<{id:string}> };
export async function GET(_request: Request, context: Context): Promise<Response> {
  try { return Response.json(await getStrategyView((await context.params).id)); }
  catch (error) { return strategyErrorResponse(error); }
}
export async function PATCH(request: Request, context: Context): Promise<Response> {
  try { return Response.json(await updateStrategyDraft((await context.params).id, await strategyBody(request))); }
  catch (error) { return strategyErrorResponse(error); }
}
