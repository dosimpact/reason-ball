import { z } from "zod";
import { parseBody, respondToError } from "@/server/sessions/http";
import { reflectAnalysis } from "@/server/sessions/analysis";

const inputSchema = z.strictObject({ planId: z.uuid(), reason: z.string().trim().min(1).max(4000) });
export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/analysis/reflection">): Promise<Response> {
  try { const { id } = await context.params; const { planId, reason } = await parseBody(request, inputSchema); return Response.json(await reflectAnalysis(id, planId, reason)); }
  catch (error) { return respondToError(error); }
}
