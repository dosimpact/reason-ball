import { replayInputSchema } from "@/entities/tutorial";
import { parseBody, respondToError } from "@/server/sessions/http";
import { replaySession } from "@/server/sessions/service";

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/replay">): Promise<Response> {
  try {
    const { id } = await context.params;
    const { expectedCursor } = await parseBody(request, replayInputSchema);
    return Response.json(await replaySession(id, expectedCursor));
  } catch (error) {
    return respondToError(error);
  }
}
