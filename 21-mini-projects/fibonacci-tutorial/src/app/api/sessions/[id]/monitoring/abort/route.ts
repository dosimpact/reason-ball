import { z } from "zod";
import { parseBody, respondToError } from "@/server/sessions/http";
import { abortSessionMonitoring } from "@/server/sessions/monitoring";

const abortInputSchema = z.strictObject({
  expectedPlanId: z.uuid(),
  expectedCursor: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/monitoring/abort">): Promise<Response> {
  try {
    const { id } = await context.params;
    const input = await parseBody(request, abortInputSchema);
    return Response.json(await abortSessionMonitoring(id, input));
  } catch (error) { return respondToError(error); }
}
