import { uuidSchema } from "@/shared/api/supabase/domain";
import {
  createPrivilegedClient,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";

import { getMockRun, getMockSession, withMockSession } from "../_lib/mock-store";
import { getOwnedRunRow, hydrateProductionRun } from "../_lib/production";
import { isMockRuntime, routeError, routeSuccess } from "../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = createRequestId();
  const runId = (await context.params).id;

  if (isMockRuntime()) {
    const { session, sessionId } = getMockSession(request);
    const run = getMockRun(session, runId);
    const response = run
      ? routeSuccess({ run }, requestId)
      : routeError(404, "MISSION_RUN_NOT_FOUND", "The mission run could not be found.", requestId);
    return withMockSession(response, sessionId);
  }

  try {
    if (!uuidSchema.safeParse(runId).success) {
      throw new SupabaseHttpError(400, "INVALID_MISSION_RUN_ID", "The mission run id is invalid.");
    }
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const row = await getOwnedRunRow(client, user.id, runId);
    return jsonSuccessResponse(requestId, { run: await hydrateProductionRun(createPrivilegedClient(), row) });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
