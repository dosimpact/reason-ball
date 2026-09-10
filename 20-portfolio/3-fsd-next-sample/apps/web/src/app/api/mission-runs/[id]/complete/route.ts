import {
  missionCompletionSchema,
  uuidSchema,
} from "@/shared/api/supabase/domain";
import {
  createPrivilegedClient,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";

import { completeMockRun, getMockSession, withMockSession } from "../../_lib/mock-store";
import { getOwnedRunRow, hydrateProductionRun } from "../../_lib/production";
import { isMockRuntime, routeError, routeSuccess } from "../../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MissionRunRouteContext = {
  params: Promise<{ id: string }>;
};

type CompletionRpcRow = {
  mission_run_id: string;
  mission_evaluation_id: string;
  reward_unlock_id: string;
  score: number | string | null;
  stars: number | null;
  experience_points_awarded: number;
  already_completed: boolean;
};

function numberOrNull(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request, context: MissionRunRouteContext) {
  const requestId = createRequestId();

  try {
    const runId = (await context.params).id;
    const parsed = await parseJsonBody(
      request,
      missionCompletionSchema,
      requestId,
    );
    if (!parsed.ok) return parsed.response;

    if (isMockRuntime()) {
      const { session, sessionId } = getMockSession(request);
      const completed = completeMockRun(
        session,
        runId,
        parsed.data.evaluationId,
        parsed.data.rewardId,
      );
      const response = !completed
        ? routeError(404, "MISSION_RUN_NOT_FOUND", "The mission run could not be found.", requestId)
        : "error" in completed
          ? routeError(409, "MISSION_COMPLETION_INVALID_STATE", completed.error, requestId)
          : routeSuccess(completed, requestId);
      return withMockSession(response, sessionId);
    }

    if (!uuidSchema.safeParse(runId).success) {
      throw new SupabaseHttpError(
        400,
        "INVALID_MISSION_RUN_ID",
        "The mission run id is invalid.",
      );
    }

    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);

    const admin = createPrivilegedClient();
    const rpcResult = await admin.rpc("complete_mission_run", {
      _mission_run_id: runId,
      _mission_evaluation_id: parsed.data.evaluationId,
      _mission_reward_id: parsed.data.rewardId,
      _expected_owner_id: user.id,
    });

    if (rpcResult.error) {
      const code = rpcResult.error.code;
      if (code === "P0002") {
        throw new SupabaseHttpError(
          404,
          "MISSION_COMPLETION_NOT_FOUND",
          "The mission run, evaluation, or reward could not be found.",
        );
      }
      if (code === "42501") {
        throw new SupabaseHttpError(
          403,
          "MISSION_RUN_FORBIDDEN",
          "The mission run does not belong to the authenticated user.",
        );
      }
      if (code === "23514") {
        throw new SupabaseHttpError(
          409,
          "MISSION_COMPLETION_INVALID_STATE",
          "The mission run is not ready to complete with this evaluation and reward.",
        );
      }
      if (code === "40001" || code === "40P01") {
        throw new SupabaseHttpError(
          409,
          "MISSION_COMPLETION_CONFLICT",
          "The mission completion conflicted with another update. Please retry.",
          true,
        );
      }

      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The data service could not complete the mission.",
        true,
        `complete_mission_run:${code ?? "unknown"}`,
      );
    }

    const row = ((rpcResult.data ?? []) as CompletionRpcRow[])[0];
    if (!row) {
      throw new SupabaseHttpError(
        502,
        "MISSION_COMPLETION_EMPTY_RESULT",
        "The data service returned no mission completion result.",
        true,
      );
    }

    const result = {
        missionRunId: row.mission_run_id,
        missionEvaluationId: row.mission_evaluation_id,
        rewardUnlockId: row.reward_unlock_id,
        score: numberOrNull(row.score) ?? 0,
        stars: row.stars ?? 0,
        experiencePointsAwarded: row.experience_points_awarded,
        alreadyCompleted: row.already_completed,
      };
    const runRow = await getOwnedRunRow(client, user.id, runId);
    return jsonSuccessResponse(requestId, {
      result,
      run: await hydrateProductionRun(admin, runRow, result),
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
