import {
  getMission,
  missionDraftSchema,
  resourceIdSchema,
  resolveResource,
} from "@/shared/api/supabase/domain";
import { z } from "zod";
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

type MissionRouteContext = {
  params: Promise<{ id: string }>;
};

const lifecycleMutationSchema = z
  .object({ action: z.enum(["publish", "archive"]) })
  .strict();

const versionMutationSchema = z
  .object({
    action: z.literal("create-version"),
    expectedVersion: z.number().int().positive(),
    changeSummary: z.string().trim().min(1).max(500).optional(),
    draft: missionDraftSchema,
  })
  .strict();

const mutationSchema = z.union([
  lifecycleMutationSchema,
  versionMutationSchema,
]);

async function parseIdentifier(context: MissionRouteContext) {
  const parsedId = resourceIdSchema.safeParse((await context.params).id);
  if (!parsedId.success) {
    throw new SupabaseHttpError(
      400,
      "INVALID_MISSION_ID",
      "The mission id is invalid.",
    );
  }
  return parsedId.data;
}

export async function GET(_request: Request, context: MissionRouteContext) {
  const requestId = createRequestId();

  try {
    const identifier = await parseIdentifier(context);

    const client = await createRequestClient();
    const item = await getMission(client, identifier);
    if (!item) {
      throw new SupabaseHttpError(
        404,
        "MISSION_NOT_FOUND",
        "The mission could not be found.",
      );
    }

    return jsonSuccessResponse(requestId, { item });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: MissionRouteContext) {
  const requestId = createRequestId();

  try {
    assertTrustedMutationRequest(request);
    const identifier = await parseIdentifier(context);
    const parsed = await parseJsonBody(
      request,
      mutationSchema,
      requestId,
      16 * 1024 * 1024,
    );
    if (!parsed.ok) return parsed.response;

    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const mission = await resolveResource(client, "missions", identifier);

    if (parsed.data.action === "create-version") {
      if (parsed.data.draft.publishStatus === "archived") {
        throw new SupabaseHttpError(
          409,
          "INVALID_RESOURCE_STATE",
          "Create a draft or published version before archiving the mission.",
        );
      }

      const character = await resolveResource(
        client,
        "characters",
        parsed.data.draft.recommendedCharacterId,
      );
      const versionId = crypto.randomUUID();
      const admin = createPrivilegedClient();
      let rewardImage:
        | (StoredImage & { missionRewardId: string })
        | undefined;
      if (parsed.data.draft.rewardImageUrl?.startsWith("data:")) {
        const decoded = decodeImageDataUrl(parsed.data.draft.rewardImageUrl);
        const stored = await storeImage(client, {
          userId: user.id,
          resourceId: mission.id,
          bucket: STORAGE_BUCKETS.characterPrivate,
          ...decoded,
        });
        rewardImage = { ...stored, missionRewardId: crypto.randomUUID() };
      }

      const result = await admin.rpc("create_mission_version", {
        _mission_id: mission.id,
        _mission_version_id: versionId,
        _expected_owner_id: user.id,
        _expected_version_number: parsed.data.expectedVersion,
        _payload: {
          ...missionRpcPayload(
            parsed.data.draft,
            mission.id,
            character.id,
            rewardImage,
          ),
          changeSummary: parsed.data.changeSummary,
        },
      });
      if (result.error) {
        await removeStoredImage(client, rewardImage);
        throwMutationError(result.error, "missions.create_version_atomic");
      }

      const item = await getMission(client, mission.id);
      if (!item) {
        throw new SupabaseHttpError(
          502,
          "DATA_SERVICE_ERROR",
          "The new mission version could not be loaded.",
          true,
        );
      }
      const mutation = (result.data ?? [])[0];
      return jsonSuccessResponse(requestId, {
        item,
        versionId,
        versionNumber: mutation?.version_number ?? null,
        rewardId: mutation?.mission_reward_id ?? null,
      });
    }

    const functionName =
      parsed.data.action === "publish" ? "publish_mission" : "archive_mission";
    const result = await createPrivilegedClient().rpc(functionName, {
      _mission_id: mission.id,
      _expected_owner_id: user.id,
    });
    if (result.error) throwMutationError(result.error, `missions.${parsed.data.action}`);

    const item = await getMission(client, mission.id);
    if (!item) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The updated mission could not be loaded.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, { item });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
