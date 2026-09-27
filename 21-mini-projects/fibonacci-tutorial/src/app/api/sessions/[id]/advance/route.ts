import { advanceInputSchema } from "@/entities/tutorial";
import { parseBody, respondToError } from "@/server/sessions/http";
import { advanceSession } from "@/server/sessions/service";

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/advance">): Promise<Response> {
  try {
    const { id } = await context.params;
    const { expectedStep, direction } = await parseBody(request, advanceInputSchema);
    return Response.json(await advanceSession(id, expectedStep, direction));
  } catch (error) { return respondToError(error); }
}
