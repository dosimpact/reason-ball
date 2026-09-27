import { analysisPlanSchema } from "@/entities/lesson";
import { parseBody, respondToError } from "@/server/sessions/http";
import { confirmAnalysisPlan } from "@/server/sessions/analysis";

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/analysis/plan">): Promise<Response> {
  try { const { id } = await context.params; return Response.json(await confirmAnalysisPlan(id, await parseBody(request, analysisPlanSchema))); }
  catch (error) { return respondToError(error); }
}
