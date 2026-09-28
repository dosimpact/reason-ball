import { z } from "zod";
import { parseBody, respondToError } from "@/server/sessions/http";
import { reviseAnalysisPlan } from "@/server/sessions/analysis";

const inputSchema = z.strictObject({ expectedPlanId: z.uuid() });
export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/analysis/revise">): Promise<Response> {
  try { const { id } = await context.params; const { expectedPlanId } = await parseBody(request, inputSchema); return Response.json(await reviseAnalysisPlan(id, expectedPlanId)); }
  catch (error) { return respondToError(error); }
}
