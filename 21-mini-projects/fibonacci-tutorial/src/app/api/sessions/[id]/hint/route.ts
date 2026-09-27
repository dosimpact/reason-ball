import { z } from "zod";
import { parseBody, respondToError } from "@/server/sessions/http";
import { revealHint } from "@/server/sessions/service";

const inputSchema = z.strictObject({ kind: z.enum(["hint", "example"]) });
export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/hint">): Promise<Response> {
  try {
    const { id } = await context.params;
    const { kind } = await parseBody(request, inputSchema);
    return Response.json(await revealHint(id, kind));
  } catch (error) { return respondToError(error); }
}
