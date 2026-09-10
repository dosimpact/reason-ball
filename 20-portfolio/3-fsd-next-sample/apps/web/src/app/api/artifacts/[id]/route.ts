import {
  artifactDto,
  artifactPatchSchema,
} from "@/shared/api/supabase/chatbot";
import { uuidSchema } from "@/shared/api/supabase/domain";
import { artifactPageSize, readArtifactVersionPage } from "@/shared/api/supabase/artifact-pages";
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
const artifactColumns =
  "id, owner_id, conversation_id, kind, title, status, current_version_id, created_at, updated_at";

async function artifactId(context: RouteContext) {
  const parsed = uuidSchema.safeParse((await context.params).id);
  if (!parsed.success) {
    throw new SupabaseHttpError(
      400,
      "INVALID_ARTIFACT_ID",
      "The artifact id is invalid.",
    );
  }
  return parsed.data;
}

async function ownedArtifact(
  admin: ReturnType<typeof createPrivilegedClient>,
  id: string,
  ownerId: string,
) {
  const result = await admin
    .from("artifacts")
    .select(artifactColumns)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .limit(1);
  assertDatabaseSuccess(result.error, "artifacts.require_owner");
  const row = (result.data ?? [])[0];
  if (!row) {
    throw new SupabaseHttpError(
      404,
      "ARTIFACT_NOT_FOUND",
      "The artifact could not be found.",
    );
  }
  return row;
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    const id = await artifactId(context);
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const artifact = await ownedArtifact(admin, id, user.id);
    const limit = artifactPageSize.safeParse(new URL(request.url).searchParams.get("limit") ?? undefined);
    if (!limit.success) throw new SupabaseHttpError(400, "INVALID_PAGE_LIMIT", "A limit of 1–200 is required.");
    const versions = await readArtifactVersionPage(admin, id, artifact.current_version_id, 0, limit.data);
    return jsonSuccessResponse(requestId, {
      item: artifactDto(artifact),
      ...versions,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = await artifactId(context);
    const parsed = await parseJsonBody(
      request,
      artifactPatchSchema,
      requestId,
      8 * 1024,
    );
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    await ownedArtifact(admin, id, user.id);
    const result = await admin.rpc("update_artifact_state", {
      _artifact_id: id,
      _expected_owner_id: user.id,
      _title: parsed.data.title ?? null,
      _status: parsed.data.status ?? null,
    });
    if (result.error) throwMutationError(result.error, "artifacts.update_state");
    const artifact = await ownedArtifact(admin, id, user.id);
    return jsonSuccessResponse(requestId, { item: artifactDto(artifact) });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = await artifactId(context);
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    const artifact = await ownedArtifact(admin, id, user.id);
    const publishedVersions = await admin
      .from("artifact_versions")
      .select("id", { count: "exact", head: true })
      .eq("artifact_id", id)
      .not("published_at", "is", null);
    assertDatabaseSuccess(
      publishedVersions.error,
      "artifact_versions.delete_guard",
    );
    const canHardDelete =
      artifact.status === "draft" && (publishedVersions.count ?? 0) === 0;
    const functionName =
      canHardDelete
        ? "delete_owned_artifact"
        : "update_artifact_state";
    const args =
      canHardDelete
        ? { _artifact_id: id, _expected_owner_id: user.id }
        : {
            _artifact_id: id,
            _expected_owner_id: user.id,
            _title: null,
            _status: "archived",
          };
    const result = await admin.rpc(functionName, args);
    if (result.error) throwMutationError(result.error, "artifacts.delete_or_archive");
    return jsonSuccessResponse(requestId, {
      deleted: canHardDelete,
      archived: !canHardDelete,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
