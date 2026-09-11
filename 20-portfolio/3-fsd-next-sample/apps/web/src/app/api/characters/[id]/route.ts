import {
  characterDraftSchema,
  getCharacter,
  resourceIdSchema,
  resolveResource,
} from "@/shared/api/supabase/domain";
import { z } from "zod";
import {
  assertTrustedMutationRequest,
  assertDatabaseSuccess,
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
  bucketForCharacter,
  characterRpcPayload,
  copyCharacterImageForVisibility,
  decodeImageDataUrl,
  removeStoredImage,
  storeImage,
  type StoredImage,
} from "@/shared/api/supabase/publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CharacterRouteContext = {
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
    draft: characterDraftSchema,
  })
  .strict();

const mutationSchema = z.union([
  lifecycleMutationSchema,
  versionMutationSchema,
]);

async function parseIdentifier(context: CharacterRouteContext) {
  const parsedId = resourceIdSchema.safeParse((await context.params).id);
  if (!parsedId.success) {
    throw new SupabaseHttpError(
      400,
      "INVALID_CHARACTER_ID",
      "The character id is invalid.",
    );
  }
  return parsedId.data;
}

export async function GET(_request: Request, context: CharacterRouteContext) {
  const requestId = createRequestId();

  try {
    const identifier = await parseIdentifier(context);

    const client = await createRequestClient();
    const item = await getCharacter(client, identifier);
    if (!item) {
      throw new SupabaseHttpError(
        404,
        "CHARACTER_NOT_FOUND",
        "The character could not be found.",
      );
    }

    return jsonSuccessResponse(requestId, { item });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: CharacterRouteContext) {
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
    const character = await resolveResource(client, "characters", identifier);
    // Readability of a published character does not authorize mutation or copying.
    const owned = await client.from("characters").select("id, current_version_id, visibility")
      .eq("id", character.id).eq("owner_id", user.id).limit(1);
    assertDatabaseSuccess(owned.error, "characters.mutation_owner");
    if (!owned.data?.[0]) {
      throw new SupabaseHttpError(403, "CHARACTER_NOT_OWNED", "Only the owner may change this character.");
    }

    if (parsed.data.action === "create-version") {
      if (parsed.data.draft.publishStatus === "archived") {
        throw new SupabaseHttpError(
          409,
          "INVALID_RESOURCE_STATE",
          "Create a draft or published version before archiving the character.",
        );
      }

      const versionId = crypto.randomUUID();
      const admin = createPrivilegedClient();
      let image: StoredImage | undefined;
      if (parsed.data.draft.imageUrl?.startsWith("data:")) {
        const decoded = decodeImageDataUrl(parsed.data.draft.imageUrl);
        image = await storeImage(client, {
          userId: user.id,
          resourceId: character.id,
          bucket: bucketForCharacter(parsed.data.draft),
          ...decoded,
        });
      } else {
        image = await copyCharacterImageForVisibility(client, {
          userId: user.id, resourceId: character.id,
          versionId: owned.data[0].current_version_id,
          currentVisibility: owned.data[0].visibility,
          bucket: bucketForCharacter(parsed.data.draft),
        });
      }

      const result = await admin.rpc("create_character_version", {
        _character_id: character.id,
        _character_version_id: versionId,
        _expected_owner_id: user.id,
        _expected_version_number: parsed.data.expectedVersion,
        _payload: {
          ...characterRpcPayload(parsed.data.draft, character.id, image),
          changeSummary: parsed.data.changeSummary,
        },
      });
      if (result.error) {
        await removeStoredImage(client, image);
        throwMutationError(result.error, "characters.create_version_atomic");
      }

      const item = await getCharacter(client, character.id);
      if (!item) {
        throw new SupabaseHttpError(
          502,
          "DATA_SERVICE_ERROR",
          "The new character version could not be loaded.",
          true,
        );
      }
      const mutation = (result.data ?? [])[0];
      return jsonSuccessResponse(requestId, {
        item,
        versionId,
        versionNumber: mutation?.version_number ?? null,
      });
    }

    const functionName =
      parsed.data.action === "publish" ? "publish_character" : "archive_character";
    const result = await createPrivilegedClient().rpc(functionName, {
      _character_id: character.id,
      _expected_owner_id: user.id,
    });
    if (result.error) throwMutationError(result.error, `characters.${parsed.data.action}`);

    const item = await getCharacter(client, character.id);
    if (!item) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The updated character could not be loaded.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, { item });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
