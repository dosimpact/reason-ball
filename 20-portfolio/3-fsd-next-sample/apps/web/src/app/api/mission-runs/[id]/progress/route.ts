import { z } from "zod";

import { uuidSchema } from "@/shared/api/supabase/domain";
import {
  assertDatabaseSuccess,
  createPrivilegedClient,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";

import { getMockSession, updateMockProgress, withMockSession } from "../../_lib/mock-store";
import { getOwnedRunRow, hydrateProductionRun } from "../../_lib/production";
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
    const admin = createPrivilegedClient();
    const row = await getOwnedRunRow(client, user.id, runId);
    if (["passed", "abandoned"].includes(row.status)) {
      throw new SupabaseHttpError(409, "MISSION_RUN_FINALIZED", "A finalized mission run cannot be changed.");
    }

    const definitionResult = await admin
      .from("mission_steps")
      .select("id, step_order, is_optional")
      .eq("id", parsed.data.stepId)
      .eq("mission_version_id", row.mission_version_id)
      .limit(1);
    assertDatabaseSuccess(definitionResult.error, "mission_steps.verify_progress");
    const definition = (definitionResult.data ?? [])[0] as
      | { id: string; step_order: number; is_optional: boolean }
      | undefined;
    if (!definition) {
      throw new SupabaseHttpError(404, "MISSION_STEP_NOT_FOUND", "The mission step could not be found.");
    }
    if (!definition.is_optional && parsed.data.status === "skipped") {
      throw new SupabaseHttpError(409, "REQUIRED_STEP_CANNOT_SKIP", "A required mission step cannot be skipped.");
    }

    const currentResult = await admin
      .from("mission_step_progress")
      .select("attempts")
      .eq("mission_run_id", runId)
      .eq("mission_step_id", parsed.data.stepId)
      .limit(1);
    assertDatabaseSuccess(currentResult.error, "mission_step_progress.current");
    const current = (currentResult.data ?? [])[0] as { attempts: number } | undefined;
    if (!current) {
      throw new SupabaseHttpError(404, "MISSION_STEP_NOT_FOUND", "The mission step could not be found.");
    }

    const now = new Date().toISOString();
    const updateResult = await admin
      .from("mission_step_progress")
      .update({
        status: parsed.data.status,
        attempts: current.attempts + 1,
        evidence_message_ids: parsed.data.evidenceMessageIds,
        score: parsed.data.score,
        feedback: parsed.data.feedback,
        started_at: parsed.data.status === "active" ? now : undefined,
        completed_at: ["completed", "skipped"].includes(parsed.data.status) ? now : null,
      })
      .eq("mission_run_id", runId)
      .eq("mission_step_id", parsed.data.stepId);
    assertDatabaseSuccess(updateResult.error, "mission_step_progress.update");

    let currentStepOrder = definition.step_order;
    if (["completed", "skipped"].includes(parsed.data.status)) {
      const nextResult = await admin
        .from("mission_steps")
        .select("id, step_order")
        .eq("mission_version_id", row.mission_version_id)
        .gt("step_order", definition.step_order)
        .order("step_order", { ascending: true })
        .limit(1);
      assertDatabaseSuccess(nextResult.error, "mission_steps.next_progress");
      const next = (nextResult.data ?? [])[0] as { id: string; step_order: number } | undefined;
      if (next) {
        const activateResult = await admin
          .from("mission_step_progress")
          .update({ status: "active", started_at: now })
          .eq("mission_run_id", runId)
          .eq("mission_step_id", next.id)
          .eq("status", "locked");
        assertDatabaseSuccess(activateResult.error, "mission_step_progress.activate_next");
        currentStepOrder = next.step_order;
      }
    }
    const runUpdate = await admin
      .from("mission_runs")
      .update({
        status: "in-progress",
        current_step_order: currentStepOrder,
        turn_count: Math.max(row.turn_count, parsed.data.turnCount ?? 0),
      })
      .eq("id", runId);
    assertDatabaseSuccess(runUpdate.error, "mission_runs.update_progress");
    const refreshed = await getOwnedRunRow(client, user.id, runId);
    return jsonSuccessResponse(requestId, { run: await hydrateProductionRun(admin, refreshed) });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
