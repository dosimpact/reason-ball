import { respondToError } from "@/server/sessions/http";
import { exportSession } from "@/server/sessions/service";

export async function GET(_request: Request, context: RouteContext<"/api/sessions/[id]/export">): Promise<Response> {
  try {
    const { id } = await context.params;
    return Response.json(await exportSession(id));
  } catch (error) { return respondToError(error); }
}
