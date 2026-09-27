import { z } from "zod";
import { parseBody, respondToError } from "@/server/sessions/http";
import { evaluateLaterMarket } from "@/server/sessions/service";

const inputSchema = z.strictObject({});
export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/evaluate">): Promise<Response> {
  try {
    const { id } = await context.params;
    await parseBody(request, inputSchema);
    return Response.json(await evaluateLaterMarket(id));
  } catch (error) { return respondToError(error); }
}
