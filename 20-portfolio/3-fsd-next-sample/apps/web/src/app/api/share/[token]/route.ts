import {
  artifactDto,
  artifactVersionDto,
  conversationDto,
  messageDto,
} from "@/shared/api/supabase/chatbot";
import { uuidSchema } from "@/shared/api/supabase/domain";
import {
  assertDatabaseSuccess,
  createPrivilegedClient,
  createRequestId,
  jsonSuccessResponse,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    const token = uuidSchema.safeParse((await context.params).token);
    if (!token.success) {
      throw new SupabaseHttpError(
        404,
        "SHARED_CONVERSATION_NOT_FOUND",
        "The shared conversation could not be found.",
      );
    }
    const admin = createPrivilegedClient();
    const conversationResult = await admin
      .from("conversations")
      .select(
        "id, character_id, character_version_id, mission_id, mission_version_id, title, visibility, status, model_id, last_message_at, created_at, updated_at",
      )
      .eq("share_token", token.data)
      .in("visibility", ["unlisted", "public"])
      .neq("status", "deleted")
      .limit(1);
    assertDatabaseSuccess(conversationResult.error, "conversations.share_lookup");
    const conversation = (conversationResult.data ?? [])[0];
    if (!conversation) {
      throw new SupabaseHttpError(
        404,
        "SHARED_CONVERSATION_NOT_FOUND",
        "The shared conversation could not be found.",
      );
    }

    const [messagesResult, artifactsResult] = await Promise.all([
      admin
        .from("messages")
        .select(
          "id, conversation_id, role, status, parts, plain_text, parent_message_id, model_id, finish_reason, sequence_number, created_at, updated_at",
        )
        .eq("conversation_id", conversation.id)
        .neq("role", "system")
        .eq("status", "complete")
        .order("sequence_number", { ascending: true }),
      admin
        .from("artifacts")
        .select(
          "id, conversation_id, kind, title, status, current_version_id, created_at, updated_at",
        )
        .eq("conversation_id", conversation.id)
        .eq("status", "published")
        .order("created_at", { ascending: true }),
    ]);
    assertDatabaseSuccess(messagesResult.error, "messages.share_read");
    assertDatabaseSuccess(artifactsResult.error, "artifacts.share_read");
    const artifacts = artifactsResult.data ?? [];
    const versionIds = artifacts.flatMap((artifact) =>
      artifact.current_version_id ? [artifact.current_version_id] : [],
    );
    const versionsResult = versionIds.length
      ? await admin
          .from("artifact_versions")
          .select(
            "id, artifact_id, version_number, source_message_id, content_text, content_json, storage_bucket, storage_path, published_at, created_at",
          )
          .in("id", versionIds)
          .not("published_at", "is", null)
      : { data: [], error: null };
    assertDatabaseSuccess(versionsResult.error, "artifact_versions.share_read");
    const versionByArtifact = new Map(
      (versionsResult.data ?? []).map((version) => [version.artifact_id, version]),
    );

    return jsonSuccessResponse(requestId, {
      conversation: conversationDto(conversation),
      messages: (messagesResult.data ?? []).map((message) => messageDto(message)),
      artifacts: artifacts.flatMap((artifact) => {
        const version = versionByArtifact.get(artifact.id);
        return version
          ? [{ ...artifactDto(artifact), version: artifactVersionDto(version) }]
          : [];
      }),
      readOnly: true,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
