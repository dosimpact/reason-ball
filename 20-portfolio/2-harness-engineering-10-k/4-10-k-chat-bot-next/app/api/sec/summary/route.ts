/**
 * SEC summary endpoint.
 *
 * Loads a filing by (cik, accessionNo), parses sections, and returns
 * style-specific summary plus reasoning trace.
 */
import { z } from "zod";
import { getRequestIdFromHeaders, withRequestIdHeader } from "@/lib/request-id";
import {
  createFilingNotFoundResponse,
  toSecApiErrorResponse,
} from "@/lib/sec/api-response";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { getFilingByIdentity } from "@/lib/sec/repository";
import {
  parseSecJsonBody,
  requireSecApiUser,
} from "@/lib/sec/route-helpers";
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
  const authError = await requireSecApiUser(requestId);
  if (authError) {
    return authError;
  }

  const body = await parseSecJsonBody(request, bodySchema, requestId);
  if (body instanceof Response) {
    return body;
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
