import { confirmPlanInputSchema } from "@/entities/trade-plan";
import { parseBody, respondToError } from "@/server/sessions/http";
import { confirmPlan } from "@/server/sessions/service";

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/plan">): Promise<Response> {
  try {
    const { id } = await context.params;
    const input = await parseBody(request, confirmPlanInputSchema);
    return Response.json(await confirmPlan(id, input));
  } catch (error) {
    return respondToError(error);
  }
}
