import { z } from 'zod';
import { readChatFile } from '@/entities/chat/api/server-attachments';
import { createRequestClient, createRequestId, requireAuthenticatedUser, safeSupabaseErrorResponse, SupabaseHttpError } from '@/shared/api/supabase/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const requestId = createRequestId();
  try {
    const parsed = z.object({ id: z.uuid(), attachmentId: z.uuid() }).safeParse(await context.params);
    if (!parsed.success) throw new SupabaseHttpError(400, 'INVALID_ATTACHMENT_ID', 'Valid conversation and attachment IDs are required.');
    const user = await requireAuthenticatedUser(await createRequestClient());
    const { row, bytes } = await readChatFile(parsed.data.id, user.id, parsed.data.attachmentId);
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': row.mime_type, 'Content-Length': String(bytes.length),
      'Content-Disposition': row.mime_type === 'application/pdf' ? 'attachment; filename="attachment.pdf"' : 'inline',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer', 'X-Request-Id': requestId,
    } });
  } catch (error) { return safeSupabaseErrorResponse(error, requestId); }
}
