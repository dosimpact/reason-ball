import { learningSubmissionSchema } from "@/entities/lesson";
import { parseBody, respondToError } from "@/server/sessions/http";
import { submitLesson } from "@/server/sessions/lesson";

export async function POST(request: Request, context: RouteContext<"/api/sessions/[id]/lesson/check">): Promise<Response> {
  try {
    const { id } = await context.params;
    const submission = await parseBody(request, learningSubmissionSchema);
    return Response.json(await submitLesson(id, submission));
  } catch (error) { return respondToError(error); }
}
