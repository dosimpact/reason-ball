import { z } from "zod";
import { parseBody, respondToError } from "@/server/sessions/http";
import { checkSession } from "@/server/sessions/service";

const inputSchema = z.strictObject({ waveIndices: z.array(z.number().int().nonnegative()).min(3).max(6) });
export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/check">): Promise<Response> {
  try {
    const { id } = await context.params;
    const { waveIndices } = await parseBody(request, inputSchema);
    return Response.json(await checkSession(id, waveIndices));
  } catch (error) { return respondToError(error); }
}
