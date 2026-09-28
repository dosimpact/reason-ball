import { replayInputSchema } from "@/entities/tutorial";
import { parseBody, respondToError } from "@/server/sessions/http";
import { replayAnalysis } from "@/server/sessions/analysis";

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/analysis/replay">): Promise<Response> {
  try { const { id } = await context.params; const { expectedCursor } = await parseBody(request, replayInputSchema); return Response.json(await replayAnalysis(id, expectedCursor)); }
  catch (error) { return respondToError(error); }
}
