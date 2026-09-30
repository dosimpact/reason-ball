import { z } from 'zod';
import { storeChatFile } from '@/entities/chat/api/server-attachments';
import { enforceAiRateLimit } from '@/shared/api/ai/guard';
import { assertTrustedMutationRequest, createRequestClient, createRequestId, jsonSuccessResponse, parseJsonBody, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from '@/shared/api/supabase/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const id = z.uuid().safeParse((await context.params).id);
    if (!id.success) throw new SupabaseHttpError(400, 'INVALID_CONVERSATION_ID', 'A valid conversation ID is required.');
    const user = await requireAuthenticatedUser(await createRequestClient());
    const limited = enforceAiRateLimit(request, requestId, { operation: 'chat-file-upload', authenticatedUserId: user.id, limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const parsed = await parseJsonBody(request, z.object({
      dataUrl: z.string().max(3 * 1024 * 1024), filename: z.string().trim().min(1).max(500),
    }).strict(), requestId, 3 * 1024 * 1024);
    if (!parsed.ok) return parsed.response;
    return jsonSuccessResponse(requestId, { file: await storeChatFile(id.data, user.id, parsed.data.dataUrl, parsed.data.filename) });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
