import { z } from "zod";
import {
  assertTrustedMutationRequest,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  parseJsonBody,
  safeSupabaseErrorResponse,
  throwAuthError,
  throwMutationError,
} from "@/shared/api/supabase/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resultSchema = z.object({
  mode: z.enum(["manager", "needs-profile", "assigned", "catalog-empty"]),
  assignedCount: z.number().int().nonnegative(),
}).strict();

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    assertTrustedMutationRequest(request);
    const parsed = await parseJsonBody(request, z.object({}).strict(), requestId, 1024);
    if (!parsed.ok) return parsed.response;
    const client = await createRequestClient();
    const authentication = await client.auth.getUser();
    if (authentication.error && authentication.error.name !== "AuthSessionMissingError") {
      throwAuthError(authentication.error, "mission_assignments.authenticate");
    }
    if (!authentication.data.user) {
      return jsonSuccessResponse(requestId, { provisioning: { mode: "guest", assignedCount: 0 } });
    }
    // The authenticated RPC reads saved preferences and owns selection/locking.
    // No browser owner, candidate IDs, level or count reaches that boundary.
    const result = await client.rpc("provision_my_missions");
    if (result.error) throwMutationError(result.error, "mission_assignments.provision");
    return jsonSuccessResponse(requestId, { provisioning: resultSchema.parse(result.data) });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
