import { generateText, Output } from "ai";
import { z } from "zod";
import { generatedMissionHintSchema, missionHintFromRow, missionHintInstructions, missionHintRequestSchema } from "@/entities/mission-run/model/mission-hint";
import type { MissionHint } from "@/entities/mission-run/model/types";
import { loadLearningPreferences } from "@/entities/learner/api/server-preferences";
import { createAiCapabilities, createRequestId, enforceAiRateLimit, jsonSuccessResponse, parseJsonBody, recordAiObservation, safeAiErrorResponse } from "@/shared/api/ai";
import { assertDatabaseSuccess, assertTrustedMutationRequest, createPrivilegedClient, createRequestClient, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError, throwMutationError } from "@/shared/api/supabase/http";
import { getOwnedRunRow } from "../../_lib/production";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const columns = "id,mission_run_id,mission_step_id,depth,result,context_message_id,context_sequence_number,created_at";

async function ownedContext(context: Context) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) throw new SupabaseHttpError(400, "INVALID_MISSION_RUN_ID", "미션 실행 ID가 올바르지 않아요.");
  const client = await createRequestClient();
  const user = await requireAuthenticatedUser(client);
  const run = await getOwnedRunRow(client, user.id, id);
  return { client, user, run };
}

export async function GET(_request: Request, context: Context) {
  const requestId = createRequestId();
  try {
    const { client, run } = await ownedContext(context);
    const items: MissionHint[] = [];
    let cursor: string | undefined;
    // Stable UUID keyset pages also work when the Data API imposes a lower row cap.
    for (;;) {
      let query = client.from("mission_hint_requests").select(columns).eq("mission_run_id", run.id).order("id").limit(200);
      if (cursor) query = query.gt("id", cursor);
      const result = await query;
      assertDatabaseSuccess(result.error, "mission_hints.history");
      if (!result.data?.length) break;
      const page = result.data.map(missionHintFromRow);
      items.push(...page);
      cursor = page[page.length - 1].id;
    }
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return jsonSuccessResponse(requestId, { items });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}

export async function POST(request: Request, context: Context) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(request, missionHintRequestSchema, requestId, 4096);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const { client, user, run } = await ownedContext(context);
    const admin = createPrivilegedClient();
    const stored = await admin.from("mission_hint_requests").select(columns).eq("id", input.requestId).maybeSingle();
    assertDatabaseSuccess(stored.error, "mission_hints.replay");
    if (stored.data) {
      if (stored.data.mission_run_id !== run.id || stored.data.mission_step_id !== input.stepId || stored.data.depth !== input.depth) throw new SupabaseHttpError(409, "MISSION_HINT_REQUEST_CONFLICT", "이 요청 ID는 다른 힌트에 이미 사용되었어요.");
      return jsonSuccessResponse(requestId, { hint: missionHintFromRow(stored.data) });
    }
    if (run.status === "abandoned") throw new SupabaseHttpError(409, "MISSION_RUN_FINALIZED", "중단된 미션에서는 힌트를 요청할 수 없어요.");
    const conversation = await client.from("conversations").select("id").eq("id", run.conversation_id).eq("owner_id", user.id).eq("status", "active").maybeSingle();
    assertDatabaseSuccess(conversation.error, "mission_hints.conversation");
    if (!conversation.data) throw new SupabaseHttpError(409, "MISSION_HINT_CONTEXT_CHANGED", "활성 대화를 다시 불러온 뒤 요청해 주세요.");
    const limited = enforceAiRateLimit(request, requestId, { operation: "mission-hint", authenticatedUserId: user.id, limit: 20, windowMs: 60_000 });
    if (limited) return limited;
    const [step, mission, character, history, preferences] = await Promise.all([
      client.from("mission_steps").select("id,title,objective,learner_goal,hints").eq("id", input.stepId).eq("mission_version_id", run.mission_version_id).maybeSingle(),
      client.from("mission_versions").select("scenario_context,learner_role,character_role,opening_instruction,target_vocabulary,target_grammar").eq("id", run.mission_version_id).maybeSingle(),
      client.from("character_versions").select("personality_summary,greeting,backstory").eq("id", run.character_version_id).maybeSingle(),
      client.from("messages").select("id,role,parts,sequence_number").eq("conversation_id", run.conversation_id).eq("status", "complete").in("role", ["user", "assistant"]).order("sequence_number", { ascending: false }).limit(8),
      loadLearningPreferences(client, user.id),
    ]);
    for (const result of [step, mission, character, history]) assertDatabaseSuccess(result.error, "mission_hints.context");
    if (!step.data || !mission.data || !character.data) throw new SupabaseHttpError(404, "MISSION_HINT_STEP_NOT_FOUND", "고정된 미션의 학습 단계를 찾지 못했어요.");
    const latest = history.data?.[0];
    const messages = [...(history.data ?? [])].reverse().map((row) => ({ role: row.role, text: Array.isArray(row.parts) ? row.parts.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n").slice(0, 4000) : "" })).filter((row) => row.text.trim());
    const capabilities = createAiCapabilities({ operation: "learning-assistance" });
    const generated = await generateText({ model: capabilities.languageModel, instructions: missionHintInstructions(input.depth),
      prompt: JSON.stringify({ depth: input.depth, level: preferences.settings.learnerLevel, mission: mission.data, character: character.data, selectedStep: step.data, messages }),
      output: Output.object({ schema: generatedMissionHintSchema }), abortSignal: request.signal, maxRetries: 0, maxOutputTokens: 1200,
      timeout: { totalMs: 30_000, stepMs: 30_000 }, providerOptions: capabilities.providerName === "mock" ? undefined : { openai: { store: false } },
    });
    const result = generatedMissionHintSchema.parse(generated.output);
    request.signal.throwIfAborted();
    const persisted = await admin.rpc("persist_mission_hint", { _expected_owner_id: user.id, _request_id: input.requestId, _mission_run_id: run.id, _mission_step_id: input.stepId, _depth: input.depth, _result: result, _context_message_id: latest?.id ?? null, _context_sequence_number: latest?.sequence_number ?? null });
    if (persisted.error) throwMutationError(persisted.error, "mission_hints.persist");
    const hint = missionHintFromRow(persisted.data);
    recordAiObservation({ requestId, operation: "mission-hint", startedAt, outcome: "success", provider: capabilities.providerName, model: capabilities.modelIds.chat, usage: generated.usage });
    return jsonSuccessResponse(requestId, { hint });
  } catch (error) {
    recordAiObservation({ requestId, operation: "mission-hint", startedAt, outcome: request.signal.aborted ? "aborted" : "error" });
    return error instanceof SupabaseHttpError ? safeSupabaseErrorResponse(error, requestId) : safeAiErrorResponse(error, requestId);
  }
}
