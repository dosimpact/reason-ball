import { readChatModelCatalog } from '@/shared/api/ai/config';
import { createRequestId, safeAiErrorResponse } from '@/shared/api/ai/errors';

export const dynamic = 'force-dynamic';

export function GET() {
  const requestId = createRequestId();
  try {
    // Only public IDs and capability flags; never serialize provider credentials.
    return Response.json({ ...readChatModelCatalog(), requestId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return safeAiErrorResponse(error, requestId); }
}
