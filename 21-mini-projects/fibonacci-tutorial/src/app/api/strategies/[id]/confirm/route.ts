import { confirmStrategy } from "@/server/strategies/service";
import { strategyBody, strategyErrorResponse } from "@/server/strategies/http";
export async function POST(request: Request, context: {params:Promise<{id:string}>}): Promise<Response> {
  try { return Response.json(await confirmStrategy((await context.params).id, await strategyBody(request))); }
  catch (error) { return strategyErrorResponse(error); }
}
