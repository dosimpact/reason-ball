import { z } from "zod";

import { resourceIdSchema, resolveResource } from "@/shared/api/supabase/domain";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const reportSchema = z
  .object({
    reason: z.enum([
      "spam",
      "unsafe",
      "sexual",
      "hate",
      "harassment",
      "impersonation",
      "copyright",
      "other",
    ]),
    details: z.string().trim().max(2_000).default(""),
  })
  .strict();

const moderationSchema = z
  .object({
    action: z.literal("move-to-review"),
    reportId: z.uuid(),
    resolutionNote: z.string().trim().max(2_000).default(""),
  })
  .strict();

async function parseCharacterId(context: RouteContext) {
  const parsed = resourceIdSchema.safeParse((await context.params).id);
  if (!parsed.success) {
    throw new SupabaseHttpError(
      400,
      "INVALID_CHARACTER_ID",
      "The character id is invalid.",
    );
  }
  return parsed.data;
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = createRequestId();

  try {
    assertTrustedMutationRequest(request);
    const identifier = await parseCharacterId(context);
    const parsed = await parseJsonBody(request, reportSchema, requestId, 8 * 1024);
    if (!parsed.ok) return parsed.response;

    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    if (user.is_anonymous) {
      throw new SupabaseHttpError(
        403,
        "PERMANENT_ACCOUNT_REQUIRED",
        "Link and verify an email before reporting a character.",
      );
    }
    const character = await resolveResource(client, "characters", identifier);
    const admin = createPrivilegedClient();
    const result = await admin.rpc("create_character_report", {
      _character_id: character.id,
      _expected_reporter_id: user.id,
      _reason: parsed.data.reason,
      _details: parsed.data.details,
    });
    if (result.error) throwMutationError(result.error, "character_reports.create");

    const report = (result.data ?? [])[0];
    if (!report) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The report could not be created.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, { report });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = createRequestId();

  try {
    assertTrustedMutationRequest(request);
    const identifier = await parseCharacterId(context);
    const parsed = await parseJsonBody(
      request,
      moderationSchema,
      requestId,
      8 * 1024,
    );
    if (!parsed.ok) return parsed.response;

    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    if (user.app_metadata?.role !== "admin") {
      throw new SupabaseHttpError(
        403,
        "ADMINISTRATOR_REQUIRED",
        "Administrator access is required for moderation.",
      );
    }
    const character = await resolveResource(client, "characters", identifier);
    const admin = createPrivilegedClient();
    const result = await admin.rpc("moderate_character_report", {
      _report_id: parsed.data.reportId,
      _character_id: character.id,
      _expected_admin_id: user.id,
      _resolution_note: parsed.data.resolutionNote,
    });
    if (result.error) throwMutationError(result.error, "character_reports.moderate");

    const moderation = (result.data ?? [])[0];
    if (!moderation) {
      throw new SupabaseHttpError(
        502,
        "DATA_SERVICE_ERROR",
        "The report could not be moved to review.",
        true,
      );
    }
    return jsonSuccessResponse(requestId, { moderation });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
