/**
 * SEC full-text reader endpoint.
 *
 * Selects a latest filing by company query and returns parsed reader payload
 * (toc/keyItems/markdown preview) from local collector file data.
 */
import { z } from "zod";
import { getRequestIdFromHeaders, withRequestIdHeader } from "@/lib/request-id";
import {
  createFilingNotFoundResponse,
  toSecApiErrorResponse,
} from "@/lib/sec/api-response";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { getLatestFiling } from "@/lib/sec/repository";
import {
  parseSecJsonBody,
  requireSecApiUser,
} from "@/lib/sec/route-helpers";

const bodySchema = z.object({
  companyQuery: z.string().trim().min(1),
  targetPeriod: z.enum(["annual", "quarterly", "auto"]).optional(),
  preferForm: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const authError = await requireSecApiUser(requestId);
  if (authError) {
    return authError;
  }

  const body = await parseSecJsonBody(request, bodySchema, requestId);
  if (body instanceof Response) {
    return body;
  }

  try {
    const filing = await getLatestFiling({
      companyQuery: body.companyQuery,
      targetPeriod: body.targetPeriod ?? "auto",
      preferForm: body.preferForm,
    });

    if (!filing) {
      return createFilingNotFoundResponse({
        companyQuery: body.companyQuery,
        requestId,
      });
    }

    const document = await loadFilingDocument({ filing });

    return withRequestIdHeader(
      Response.json({
        filing,
        reader: {
          toc: document.toc,
          keyItems: document.keyItems,
          markdownPreview: document.markdown.slice(0, 12_000),
        },
      }),
      requestId
    );
  } catch (error) {
    return toSecApiErrorResponse(error, requestId);
  }
}
