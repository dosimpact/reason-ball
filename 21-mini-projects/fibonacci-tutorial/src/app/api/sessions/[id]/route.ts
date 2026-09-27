import { respondToError } from "@/server/sessions/http";
import { getSession } from "@/server/sessions/service";

export async function GET(_request: Request, context: RouteContext<"/api/sessions/[id]">): Promise<Response> {
  try {
    const { id } = await context.params;
    return Response.json(await getSession(id));
  } catch (error) {
    return respondToError(error);
  }
}
