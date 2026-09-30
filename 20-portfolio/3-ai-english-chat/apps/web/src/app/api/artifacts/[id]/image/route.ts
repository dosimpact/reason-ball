import { createHash } from "node:crypto";
import { z } from "zod";
import { requireEditableImageArtifact } from "@/shared/api/supabase/artifact-images";
import { assertTrustedMutationRequest, createPrivilegedClient, createRequestClient, createRequestId, jsonSuccessResponse, parseJsonBody, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";
import { decodeImageDataUrl, storeImage } from "@/shared/api/supabase/publishing";
import { createUserStoragePath, STORAGE_BUCKETS } from "@/shared/api/supabase/storage";
import { hasRasterImageSignature } from "@/shared/lib/image-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsedId = z.uuid().safeParse((await context.params).id);
    if (!parsedId.success) throw new SupabaseHttpError(400, "INVALID_ARTIFACT_ID", "A valid artifact ID is required.");
    const id = parsedId.data;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    await requireEditableImageArtifact(admin, id, user.id);
    const parsed = await parseJsonBody(request, z.object({ dataUrl: z.string().max(14 * 1024 * 1024) }).strict(), requestId, 14 * 1024 * 1024);
    if (!parsed.ok) return parsed.response;
    const { bytes, mimeType } = decodeImageDataUrl(parsed.data.dataUrl);
    if (!hasRasterImageSignature(bytes, mimeType)) throw new SupabaseHttpError(415, "IMAGE_TYPE_MISMATCH", "The image bytes do not match the declared format.");
    // A content-addressed, owner/artifact-scoped key makes upload retry safe.
    // Only the server can write this bucket, and no request uses upsert.
    const digest = createHash("sha256").update(bytes).digest("hex");
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice(6);
    const image = { storageBucket: STORAGE_BUCKETS.artifactImages, storagePath: createUserStoragePath(user.id, id, `${digest}.${extension}`) };
    try {
      await storeImage(admin, { userId: user.id, resourceId: id, bucket: image.storageBucket, bytes, mimeType, assetId: digest });
    } catch (error) {
      if (!(error instanceof SupabaseHttpError) || error.code !== "IMAGE_ALREADY_EXISTS") throw error;
    }
    return jsonSuccessResponse(requestId, { image });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
