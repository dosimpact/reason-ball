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

import { getMockSession, readMockNote, withMockSession, writeMockNote } from "../../_lib/mock-store";
import { getOwnedRunRow } from "../../_lib/production";
import { isMockRuntime, routeError, routeSuccess } from "../../_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noteSchema = z.object({ note: z.string().trim().max(4_000) }).strict();
type Context = { params: Promise<{ id: string }> };

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function latestEvaluation(admin: ReturnType<typeof createPrivilegedClient>, runId: string) {
  const result = await admin
    .from("mission_evaluations")
    .select("id, feedback, completed_at")
    .eq("mission_run_id", runId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);
  assertDatabaseSuccess(result.error, "mission_evaluations.review_note");
  return (result.data ?? [])[0] as
    | { id: string; feedback: unknown; completed_at: string | null }
    | undefined;
}

export async function GET(request: Request, context: Context) {
  const requestId = createRequestId();
  const runId = (await context.params).id;
  if (isMockRuntime()) {
    const { session, sessionId } = getMockSession(request);
    const note = readMockNote(session, runId);
    return withMockSession(routeSuccess({ note }, requestId), sessionId);
  }
  try {
    if (!uuidSchema.safeParse(runId).success) {
      throw new SupabaseHttpError(400, "INVALID_MISSION_RUN_ID", "The mission run id is invalid.");
    }
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    await getOwnedRunRow(client, user.id, runId);
    const evaluation = await latestEvaluation(createPrivilegedClient(), runId);
    const feedback = objectValue(evaluation?.feedback);
    return jsonSuccessResponse(requestId, {
      note: {
        runId,
        note: typeof feedback.reviewNote === "string" ? feedback.reviewNote : "",
        updatedAt: evaluation?.completed_at ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function PUT(request: Request, context: Context) {
  const requestId = createRequestId();
  const runId = (await context.params).id;
  try {
    const parsed = await parseJsonBody(request, noteSchema, requestId, 8 * 1024);
    if (!parsed.ok) return parsed.response;
    if (isMockRuntime()) {
      const { session, sessionId } = getMockSession(request);
      const note = writeMockNote(session, runId, parsed.data.note);
      return withMockSession(routeSuccess({ note }, requestId), sessionId);
    }
    if (!uuidSchema.safeParse(runId).success) {
      throw new SupabaseHttpError(400, "INVALID_MISSION_RUN_ID", "The mission run id is invalid.");
    }
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    await getOwnedRunRow(client, user.id, runId);
    const admin = createPrivilegedClient();
    const evaluation = await latestEvaluation(admin, runId);
    if (!evaluation) {
      throw new SupabaseHttpError(409, "EVALUATION_REQUIRED", "Complete an evaluation before saving a review note.");
    }
    const updatedAt = new Date().toISOString();
    const result = await admin
      .from("mission_evaluations")
      .update({ feedback: { ...objectValue(evaluation.feedback), reviewNote: parsed.data.note, reviewNoteUpdatedAt: updatedAt } })
      .eq("id", evaluation.id);
    assertDatabaseSuccess(result.error, "mission_evaluations.save_review_note");
    return jsonSuccessResponse(requestId, { note: { runId, note: parsed.data.note, updatedAt } });
  } catch (error) {
    if (isMockRuntime()) {
      return routeError(500, "REVIEW_NOTE_ERROR", "The review note could not be saved.", requestId);
    }
    return safeSupabaseErrorResponse(error, requestId);
  }
}
