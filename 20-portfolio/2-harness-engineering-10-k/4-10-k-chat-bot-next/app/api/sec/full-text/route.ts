/**
 * SEC full-text reader endpoint.
 *
 * Selects a latest filing by company query and returns parsed reader payload
 * (toc/keyItems/markdown preview) from local collector file data.
 */
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { getRequestIdFromHeaders, withRequestIdHeader } from "@/lib/request-id";
import {
  createFilingNotFoundResponse,
  toSecApiErrorResponse,
} from "@/lib/sec/api-response";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { getLatestFiling } from "@/lib/sec/repository";

const bodySchema = z.object({
  companyQuery: z.string().trim().min(1),
  targetPeriod: z.enum(["annual", "quarterly", "auto"]).optional(),
  preferForm: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const session = await auth();

  if (!session?.user) {
    return withRequestIdHeader(
      new ChatSDKError("unauthorized:chat").toResponse(),
      requestId
    );
  }

  let body: z.infer<typeof bodySchema>;

  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return toSecApiErrorResponse(
      new ChatSDKError("bad_request:api", "Invalid request body"),
      requestId
    );
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
