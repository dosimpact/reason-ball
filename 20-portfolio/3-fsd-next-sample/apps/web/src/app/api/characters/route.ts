import {
  characterDraftSchema,
  getCharacter,
  listCharacters,
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
  bucketForCharacter,
  characterRpcPayload,
  decodeImageDataUrl,
  removeStoredImage,
  storeImage,
  type StoredImage,
} from "@/shared/api/supabase/publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();

  try {
    const client = await createRequestClient();
    const items = await listCharacters(client);
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
      characterDraftSchema,
      requestId,
      16 * 1024 * 1024,
    );
    if (!parsed.ok) return parsed.response;

    if (parsed.data.publishStatus === "archived") {
      throw new SupabaseHttpError(
        409,
        "INVALID_RESOURCE_STATE",
        "A new character cannot be created as archived.",
      );
    }

    const characterId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const admin = createPrivilegedClient();
    let image: StoredImage | undefined;
    if (parsed.data.imageUrl) {
      const decoded = decodeImageDataUrl(parsed.data.imageUrl);
      image = await storeImage(client, {
        userId: user.id,
        resourceId: characterId,
        bucket: bucketForCharacter(parsed.data),
        ...decoded,
      });
    }

    const result = await admin.rpc("create_character_with_version", {
      _character_id: characterId,
      _character_version_id: versionId,
      _expected_owner_id: user.id,
      _payload: characterRpcPayload(parsed.data, characterId, image),
    });
    if (result.error) {
      await removeStoredImage(client, image);
      throwMutationError(result.error, "characters.create_atomic");
    }

    const item = await getCharacter(client, characterId);
    if (!item) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The created character could not be loaded.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, { item, versionId });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
