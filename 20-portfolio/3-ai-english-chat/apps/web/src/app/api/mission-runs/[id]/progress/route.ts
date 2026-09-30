import { z } from "zod";

import { uuidSchema } from "@/shared/api/supabase/domain";
import {
  createRequestClient,
  createRequestId,
  parseJsonBody,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";

import { getMockSession, updateMockProgress, withMockSession } from "../../_lib/mock-store";
import { getOwnedRunRow } from "../../_lib/production";
import { isMockRuntime, routeError, routeSuccess } from "../../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const progressSchema = z
  .object({
    stepId: z.string().trim().min(1).max(200),
    status: z.enum(["active", "completed", "skipped"]),
    evidenceMessageIds: z.array(z.uuid()).max(100).optional(),
    score: z.number().min(0).max(100).optional(),
    feedback: z.string().trim().max(2_000).optional(),
    turnCount: z.number().int().min(0).max(100_000).optional(),
  })
  .strict();

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const requestId = createRequestId();
  const runId = (await context.params).id;
  try {
    const parsed = await parseJsonBody(request, progressSchema, requestId, 32 * 1024);
    if (!parsed.ok) return parsed.response;

    if (isMockRuntime()) {
      const { session, sessionId } = getMockSession(request);
      const run = updateMockProgress(session, { runId, ...parsed.data });
      const response = run
        ? routeSuccess({ run }, requestId)
        : routeError(404, "MISSION_RUN_OR_STEP_NOT_FOUND", "The mission run or step could not be found.", requestId);
      return withMockSession(response, sessionId);
    }

    if (!uuidSchema.safeParse(runId).success || !uuidSchema.safeParse(parsed.data.stepId).success) {
      throw new SupabaseHttpError(400, "INVALID_PROGRESS_ID", "The mission run or step id is invalid.");
    }
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    await getOwnedRunRow(client, user.id, runId);
    throw new SupabaseHttpError(403, "MISSION_PROGRESS_SERVER_MANAGED", "Mission progress is derived from saved learner messages by the server.");
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
