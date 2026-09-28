import { exportStrategy } from "@/server/strategies/service";
import { strategyErrorResponse } from "@/server/strategies/http";
export async function GET(_request: Request, context: {params:Promise<{id:string}>}): Promise<Response> {
  try { return Response.json(await exportStrategy((await context.params).id)); }
  catch (error) { return strategyErrorResponse(error); }
}
