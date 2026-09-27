import { respondToError } from "@/server/sessions/http";
import { evaluateLaterAnalysis } from "@/server/sessions/analysis";

export async function POST(_request: Request, context: RouteContext<"/api/sessions/[id]/analysis/evaluate">): Promise<Response> {
  try { const { id } = await context.params; return Response.json(await evaluateLaterAnalysis(id)); }
  catch (error) { return respondToError(error); }
}
