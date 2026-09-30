import { z } from "zod";

import { resolveResourceSnapshot } from "@/shared/api/supabase/domain";
import {
  assertDatabaseSuccess,
  createPrivilegedClient,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
} from "@/shared/api/supabase/http";

import { getMockSession, listMockRuns, startMockRun, withMockSession } from "./_lib/mock-store";
import { findOwnedRunToResume, getOwnedRunRow, hydrateProductionRun, startProductionRun, type MissionRunRow } from "./_lib/production";
import { isMockRuntime, routeSuccess } from "./_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startSchema = z
  .object({
    missionId: z.string().trim().min(1).max(200),
    missionTitle: z.string().trim().min(1).max(200).optional(),
    characterId: z.string().trim().min(1).max(200),
    conversationId: (isMockRuntime() ? z.string().trim().min(1).max(200) : z.uuid()).optional(),
    modelId: z.string().trim().min(1).max(100).optional(),
    steps: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(200),
          label: z.string().trim().min(1).max(500),
          required: z.boolean().optional(),
        }),
      )
      .max(30)
      .optional(),
  })
  .strict();

export async function GET(request: Request) {
  if (isMockRuntime()) {
    const { session, sessionId } = getMockSession(request);
    return withMockSession(routeSuccess({ runs: listMockRuns(session) }), sessionId);
  }

  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const result = await client
      .from("mission_runs")
      .select("id, owner_id, mission_id, mission_version_id, character_id, character_version_id, conversation_id, status, current_step_order, attempt_number, score, stars, turn_count, awarded_mission_reward_id, awarded_evaluation_id, started_at, completed_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    assertDatabaseSuccess(result.error, "mission_runs.list");
    const admin = createPrivilegedClient();
    const runs = await Promise.all(
      ((result.data ?? []) as MissionRunRow[]).map((row) =>
        hydrateProductionRun(admin, row),
      ),
    );
    return jsonSuccessResponse(requestId, { runs });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const parsed = await parseJsonBody(request, startSchema, requestId, 32 * 1024);
    if (!parsed.ok) return parsed.response;

    if (isMockRuntime()) {
      const { session, sessionId } = getMockSession(request);
      return withMockSession(
        routeSuccess({ run: startMockRun(session, parsed.data) }, requestId),
        sessionId,
      );
    }

    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const existing = await findOwnedRunToResume(client, admin, { ...parsed.data, ownerId: user.id });
    if (existing) {
      return jsonSuccessResponse(requestId, { run: await hydrateProductionRun(admin, existing) });
    }
    const [mission, character] = await Promise.all([
      resolveResourceSnapshot(client, "missions", parsed.data.missionId),
      resolveResourceSnapshot(client, "characters", parsed.data.characterId),
    ]);

    const runId = await startProductionRun(admin, {
      ownerId: user.id,
      mission,
      character,
      conversationId: parsed.data.conversationId,
      modelId: parsed.data.modelId,
    });
    const row = await getOwnedRunRow(client, user.id, runId);

    return jsonSuccessResponse(requestId, {
      run: await hydrateProductionRun(admin, row),
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
