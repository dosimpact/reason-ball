import { pollForward } from "@/server/strategies/service";
import { strategyBody, strategyErrorResponse } from "@/server/strategies/http";
export async function POST(request: Request, context: {params:Promise<{id:string;runId:string}>}): Promise<Response> {
  try { const {id,runId}=await context.params; return Response.json(await pollForward(id,runId,await strategyBody(request))); }
  catch (error) { return strategyErrorResponse(error); }
}
