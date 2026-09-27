import { reflectionInputSchema } from "@/entities/tutorial";
import { parseBody, respondToError } from "@/server/sessions/http";
import { saveReflection } from "@/server/sessions/service";

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/reflection">): Promise<Response> {
  try {
    const { id } = await context.params;
    const { decision, reason } = await parseBody(request, reflectionInputSchema);
    return Response.json(await saveReflection(id, decision, reason));
  } catch (error) { return respondToError(error); }
}
