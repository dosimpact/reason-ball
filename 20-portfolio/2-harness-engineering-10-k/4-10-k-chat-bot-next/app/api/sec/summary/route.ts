/**
 * SEC summary endpoint.
 *
 * Loads a filing by (cik, accessionNo), parses sections, and returns
 * style-specific summary plus reasoning trace.
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
import { getFilingByIdentity } from "@/lib/sec/repository";
import { summarizeFilingByStyle } from "@/lib/sec/summarizer";

const bodySchema = z.object({
  cik: z.string().trim().min(1),
  accessionNo: z.string().trim().min(1),
  style: z
    .enum(["executive", "short", "risk_focus", "key_info_first"])
    .optional()
    .default("executive"),
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
    const filing = await getFilingByIdentity({
      cik: body.cik,
      accessionNo: body.accessionNo,
    });

    if (!filing) {
      return createFilingNotFoundResponse({
        accessionNo: body.accessionNo,
        requestId,
      });
    }

    const document = await loadFilingDocument({ filing });

    const result = await summarizeFilingByStyle({
      companyName: filing.companyName,
      formType: filing.formType,
      filingDate: filing.filingDate,
      sections: document.sections,
      style: body.style,
    });

    return withRequestIdHeader(
      Response.json({
        filing,
        style: body.style,
        summary: result.summary,
        reasoningTrace: result.reasoningTrace,
      }),
      requestId
    );
  } catch (error) {
    return toSecApiErrorResponse(error, requestId);
  }
}
