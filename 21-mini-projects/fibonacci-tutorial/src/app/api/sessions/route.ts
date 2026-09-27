import { createSessionInputSchema } from "@/entities/tutorial";
import { parseBody, respondToError } from "@/server/sessions/http";
import { createSession } from "@/server/sessions/service";

export async function POST(request: Request): Promise<Response> {
  try {
    const { unitId, source } = await parseBody(request, createSessionInputSchema);
    return Response.json(await createSession(unitId, source), { status: 201 });
  } catch (error) {
    return respondToError(error);
  }
}
