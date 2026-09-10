import {
  getMission,
  listMissions,
  missionDraftSchema,
  resolveResource,
} from "@/shared/api/supabase/domain";
import {
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
import {
  decodeImageDataUrl,
  missionRpcPayload,
  removeStoredImage,
  storeImage,
  type StoredImage,
} from "@/shared/api/supabase/publishing";
import { STORAGE_BUCKETS } from "@/shared/api/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();

  try {
    const client = await createRequestClient();
    const items = await listMissions(client);
    return jsonSuccessResponse(requestId, { items });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    assertTrustedMutationRequest(request);
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const parsed = await parseJsonBody(
      request,
      missionDraftSchema,
      requestId,
      16 * 1024 * 1024,
    );
    if (!parsed.ok) return parsed.response;

    if (parsed.data.publishStatus === "archived") {
      throw new SupabaseHttpError(
        409,
        "INVALID_RESOURCE_STATE",
        "A new mission cannot be created as archived.",
      );
    }
    if (parsed.data.publishStatus === "published" && !parsed.data.rewardImageUrl) {
      throw new SupabaseHttpError(
        409,
        "MISSION_REWARD_REQUIRED",
        "A published mission requires an AI-generated reward image.",
      );
    }

    const character = await resolveResource(
      client,
      "characters",
      parsed.data.recommendedCharacterId,
    );
    const missionId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const admin = createPrivilegedClient();
    let rewardImage:
      | (StoredImage & { missionRewardId: string })
      | undefined;
    if (parsed.data.rewardImageUrl) {
      const decoded = decodeImageDataUrl(parsed.data.rewardImageUrl);
      const stored = await storeImage(client, {
        userId: user.id,
        resourceId: missionId,
        bucket: STORAGE_BUCKETS.characterPrivate,
        ...decoded,
      });
      rewardImage = { ...stored, missionRewardId: crypto.randomUUID() };
    }

    const result = await admin.rpc("create_mission_with_version", {
      _mission_id: missionId,
      _mission_version_id: versionId,
      _expected_owner_id: user.id,
      _payload: missionRpcPayload(
        parsed.data,
        missionId,
        character.id,
        rewardImage,
      ),
    });
    if (result.error) {
      await removeStoredImage(client, rewardImage);
      throwMutationError(result.error, "missions.create_atomic");
    }

    const item = await getMission(client, missionId);
    if (!item) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The created mission could not be loaded.",
        true,
      );
    }
    const mutation = (result.data ?? [])[0];
    return jsonSuccessResponse(requestId, {
      item,
      versionId,
      rewardId: mutation?.mission_reward_id ?? null,
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
