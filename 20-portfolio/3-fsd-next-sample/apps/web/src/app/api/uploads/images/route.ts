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
  removeStoredImage,
  storeImage,
} from "@/shared/api/supabase/publishing";
import { STORAGE_BUCKETS } from "@/shared/api/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commonFields = {
  resourceId: z.uuid(),
  altText: z.string().trim().max(500).default(""),
  isPrimary: z.boolean().default(false),
  visibility: z.enum(["public", "private"]).default("private"),
};

const uploadMetadataSchema = z.discriminatedUnion("resourceType", [
  z
    .object({
      ...commonFields,
      resourceType: z.literal("character"),
      assetType: z.enum(["avatar", "portrait", "background"]),
    })
    .strict(),
  z
    .object({
      ...commonFields,
      resourceType: z.literal("mission"),
      assetType: z.enum(["thumbnail", "scene", "badge"]),
    })
    .strict(),
]);

const jsonUploadSchema = z.discriminatedUnion("resourceType", [
  z
    .object({
      ...commonFields,
      resourceType: z.literal("character"),
      assetType: z.enum(["avatar", "portrait", "background"]),
      dataUrl: z.string().max(14 * 1024 * 1024),
    })
    .strict(),
  z
    .object({
      ...commonFields,
      resourceType: z.literal("mission"),
      assetType: z.enum(["thumbnail", "scene", "badge"]),
      dataUrl: z.string().max(14 * 1024 * 1024),
    })
    .strict(),
]);

async function readUpload(request: Request, requestId: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.startsWith("application/json")) {
    const parsed = await parseJsonBody(
      request,
      jsonUploadSchema,
      requestId,
      14 * 1024 * 1024,
    );
    if (!parsed.ok) return parsed;
    return {
      ok: true as const,
      data: {
        metadata: parsed.data,
        ...decodeImageDataUrl(parsed.data.dataUrl),
      },
    };
  }

  if (!contentType.startsWith("multipart/form-data")) {
    throw new SupabaseHttpError(
      415,
      "UNSUPPORTED_CONTENT_TYPE",
      "Use JSON with a dataUrl or multipart/form-data with an image file.",
    );
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (!Number.isFinite(contentLength) || contentLength > 11 * 1024 * 1024) {
    throw new SupabaseHttpError(
      413,
      "IMAGE_SIZE_INVALID",
      "Multipart image uploads require a Content-Length of at most 11 MB.",
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new SupabaseHttpError(
      400,
      "IMAGE_FILE_REQUIRED",
      "A multipart image file is required.",
    );
  }
  const metadataResult = uploadMetadataSchema.safeParse({
    resourceType: formData.get("resourceType"),
    resourceId: formData.get("resourceId"),
    assetType: formData.get("assetType"),
    altText: formData.get("altText") ?? "",
    isPrimary: formData.get("isPrimary") === "true",
    visibility: formData.get("visibility") ?? "private",
  });
  if (!metadataResult.success) {
    throw new SupabaseHttpError(
      400,
      "VALIDATION_ERROR",
      "The upload metadata is invalid.",
    );
  }
  return {
    ok: true as const,
    data: {
      metadata: metadataResult.data,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type.toLowerCase(),
    },
  };
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    assertTrustedMutationRequest(request);
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const parsed = await readUpload(request, requestId);
    if (!parsed.ok) return parsed.response;

    const { metadata, bytes, mimeType } = parsed.data;
    const isPublic = metadata.visibility === "public";
    const bucket =
      metadata.resourceType === "character"
        ? isPublic
          ? STORAGE_BUCKETS.characterPublic
          : STORAGE_BUCKETS.characterPrivate
        : isPublic
          ? STORAGE_BUCKETS.missionPublic
          : STORAGE_BUCKETS.missionPrivate;
    const image = await storeImage(client, {
      userId: user.id,
      resourceId: metadata.resourceId,
      bucket,
      bytes,
      mimeType,
    });
    const rpcName =
      metadata.resourceType === "character"
        ? "attach_character_asset"
        : "attach_mission_asset";
    const result = await createPrivilegedClient().rpc(rpcName, {
      _asset_id: image.id,
      [`_${metadata.resourceType}_id`]: metadata.resourceId,
      _expected_owner_id: user.id,
      _payload: {
        ...image,
        assetType: metadata.assetType,
        accessLevel: isPublic ? "public" : "owner",
        altText: metadata.altText,
        isPrimary: metadata.isPrimary,
        metadata: { source: "ai-generated-or-user-upload" },
      },
    });
    if (result.error) {
      await removeStoredImage(client, image);
      throwMutationError(result.error, `${metadata.resourceType}_assets.attach`);
    }

    return jsonSuccessResponse(requestId, {
      asset: {
        ...image,
        resourceType: metadata.resourceType,
        resourceId: metadata.resourceId,
        assetType: metadata.assetType,
        accessLevel: isPublic ? "public" : "owner",
      },
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
