import { z } from "zod";
import { parseBody, respondToError } from "@/server/sessions/http";
import { selectLessonCase } from "@/server/sessions/lesson";

const selectCaseSchema = z.strictObject({ caseIndex: z.number().int().nonnegative() });

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/lesson/case">): Promise<Response> {
  try {
    const { id } = await context.params;
    const { caseIndex } = await parseBody(request, selectCaseSchema);
    return Response.json(await selectLessonCase(id, caseIndex));
  } catch (error) { return respondToError(error); }
}
