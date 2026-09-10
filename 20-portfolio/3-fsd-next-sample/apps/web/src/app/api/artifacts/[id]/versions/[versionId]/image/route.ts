import { z } from "zod";
import { requireEditableImageArtifact } from "@/shared/api/supabase/artifact-images";
import { assertDatabaseSuccess, createPrivilegedClient, createRequestClient, createRequestId, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from "@/shared/api/supabase/http";
import { STORAGE_BUCKETS } from "@/shared/api/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const requestId = createRequestId();
  try {
    const parsed = z.object({ id: z.uuid(), versionId: z.uuid() }).safeParse(await context.params);
    if (!parsed.success) throw new SupabaseHttpError(400, "INVALID_ARTIFACT_VERSION_ID", "Valid artifact and version IDs are required.");
    const { id, versionId } = parsed.data;
    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();
    await requireEditableImageArtifact(admin, id, user.id);
    const result = await admin.from("artifact_versions").select("storage_bucket,storage_path")
      .eq("id", versionId).eq("artifact_id", id).maybeSingle();
    assertDatabaseSuccess(result.error, "artifact_image.version");
    const version = result.data;
    if (!version || version.storage_bucket !== STORAGE_BUCKETS.artifactImages || !version.storage_path?.startsWith(`${user.id}/${id}/`)) {
      throw new SupabaseHttpError(404, "ARTIFACT_IMAGE_NOT_FOUND", "The image could not be found.");
    }
    const signed = await admin.storage.from(STORAGE_BUCKETS.artifactImages).createSignedUrl(version.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl) throw new SupabaseHttpError(502, "ARTIFACT_IMAGE_URL_FAILED", "The private image link could not be created.", true);
    return new Response(null, { status: 302, headers: {
      Location: signed.data.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Request-Id": requestId,
    } });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
