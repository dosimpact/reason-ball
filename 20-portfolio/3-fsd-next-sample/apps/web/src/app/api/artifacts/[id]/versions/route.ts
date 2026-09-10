import {
  artifactVersionDto,
  artifactVersionSchema,
} from "@/shared/api/supabase/chatbot";
import { uuidSchema } from "@/shared/api/supabase/domain";
import { artifactPageSize, artifactVersionCursor, readArtifactVersionPage } from "@/shared/api/supabase/artifact-pages";
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

type RouteContext = { params: Promise<{ id: string }> };
const versionColumns =
  "id, artifact_id, version_number, source_message_id, content_text, content_json, storage_bucket, storage_path, published_at, created_at";

export async function GET(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    const id = uuidSchema.safeParse((await context.params).id);
    const params = new URL(request.url).searchParams;
    const snapshot = uuidSchema.safeParse(params.get("snapshotVersionId"));
    const after = artifactVersionCursor.safeParse(params.get("after") ?? undefined);
    const limit = artifactPageSize.safeParse(params.get("limit") ?? undefined);
    if (!id.success || !snapshot.success || !after.success || !limit.success) throw new SupabaseHttpError(400, "INVALID_ARTIFACT_CURSOR", "A valid artifact, snapshot version, cursor and limit are required.");
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const artifact = await client.from("artifacts").select("id").eq("id", id.data).eq("owner_id", user.id).maybeSingle();
    assertDatabaseSuccess(artifact.error, "artifact_versions.page_owner");
    if (!artifact.data) throw new SupabaseHttpError(404, "ARTIFACT_NOT_FOUND", "The artifact could not be found.");
    return jsonSuccessResponse(requestId, await readArtifactVersionPage(client, id.data, snapshot.data, after.data, limit.data));
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = uuidSchema.safeParse((await context.params).id);
    if (!id.success) {
      throw new SupabaseHttpError(
        400,
        "INVALID_ARTIFACT_ID",
        "The artifact id is invalid.",
      );
    }
    const parsed = await parseJsonBody(
      request,
      artifactVersionSchema,
      requestId,
      2 * 1024 * 1024,
    );
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const artifactResult = await client.from("artifacts").select("conversation_id")
      .eq("id", id.data).eq("owner_id", user.id).maybeSingle();
    assertDatabaseSuccess(artifactResult.error, "artifact_versions.require_owner");
    if (!artifactResult.data) throw new SupabaseHttpError(404, "ARTIFACT_NOT_FOUND", "The artifact could not be found.");
    const { requestId: versionId, expectedVersionId, ...payload } = parsed.data;
    const result = await admin.rpc("commit_artifact_revision", {
      _request_id: versionId,
      _artifact_id: id.data,
      _expected_owner_id: user.id,
      _conversation_id: artifactResult.data.conversation_id,
      _expected_version_id: expectedVersionId,
      _payload: payload,
    });
    if (result.error) throwMutationError(result.error, "artifact_versions.append");
    const versionResult = await admin
      .from("artifact_versions")
      .select(versionColumns)
      .eq("id", versionId)
      .limit(1);
    assertDatabaseSuccess(versionResult.error, "artifact_versions.appended_read");
    const version = (versionResult.data ?? [])[0];
    if (!version) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The new artifact version could not be loaded.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, {
      version: artifactVersionDto(version),
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
