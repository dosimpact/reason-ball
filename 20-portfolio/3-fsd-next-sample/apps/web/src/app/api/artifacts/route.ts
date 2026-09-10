import {
  artifactCreateSchema,
  artifactDto,
  artifactVersionDto,
} from "@/shared/api/supabase/chatbot";
import { uuidSchema } from "@/shared/api/supabase/domain";
import { artifactPageSize } from "@/shared/api/supabase/artifact-pages";
import { cursorPage } from "@/shared/lib/cursor-page";
import {
  assertDatabaseSuccess,
  assertTrustedMutationRequest,
  createPrivilegedClient,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
  throwMutationError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const artifactColumns =
  "id, conversation_id, kind, title, status, current_version_id, created_at, updated_at";
const versionColumns =
  "id, artifact_id, version_number, source_message_id, content_text, content_json, storage_bucket, storage_path, published_at, created_at";

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const params = new URL(request.url).searchParams;
    const limit = artifactPageSize.safeParse(params.get("limit") ?? undefined);
    const after = uuidSchema.optional().safeParse(params.get("after") ?? undefined);
    if (!limit.success || !after.success) throw new SupabaseHttpError(400, "INVALID_ARTIFACT_CURSOR", "A valid cursor and a limit of 1–200 are required.");
    const conversationId = uuidSchema.safeParse(
      new URL(request.url).searchParams.get("conversationId"),
    );
    if (!conversationId.success) {
      throw new SupabaseHttpError(
        400,
        "INVALID_CONVERSATION_ID",
        "A valid conversationId query parameter is required.",
      );
    }
    let query = client
      .from("artifacts")
      .select(artifactColumns)
      .eq("conversation_id", conversationId.data)
      .eq("owner_id", user.id)
      .order("id", { ascending: true }).limit(limit.data + 1);
    if (after.data) query = query.gt("id", after.data);
    const result = await query;
    assertDatabaseSuccess(result.error, "artifacts.list_owned");
    const page = cursorPage(result.data ?? [], limit.data, (row) => row.id as string);
    return jsonSuccessResponse(requestId, {
      items: page.items.map(artifactDto), hasMore: page.hasMore, nextCursor: page.nextCursor,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(
      request,
      artifactCreateSchema,
      requestId,
      2 * 1024 * 1024,
    );
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const { requestId: mutationId, ...payload } = parsed.data;
    const artifactId = mutationId;
    const versionId = mutationId;
    const result = await admin.rpc("commit_artifact_revision", {
      _request_id: mutationId,
      _artifact_id: artifactId,
      _expected_owner_id: user.id,
      _conversation_id: parsed.data.conversationId,
      _expected_version_id: null,
      _payload: payload,
    });
    if (result.error) throwMutationError(result.error, "artifacts.create_atomic");

    const [artifactResult, versionResult] = await Promise.all([
      admin.from("artifacts").select(artifactColumns).eq("id", artifactId).limit(1),
      admin
        .from("artifact_versions")
        .select(versionColumns)
        .eq("id", versionId)
        .limit(1),
    ]);
    assertDatabaseSuccess(artifactResult.error, "artifacts.created_read");
    assertDatabaseSuccess(versionResult.error, "artifact_versions.created_read");
    const artifact = (artifactResult.data ?? [])[0];
    const version = (versionResult.data ?? [])[0];
    if (!artifact || !version) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The created artifact could not be loaded.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, {
      item: artifactDto(artifact),
      version: artifactVersionDto(version),
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
