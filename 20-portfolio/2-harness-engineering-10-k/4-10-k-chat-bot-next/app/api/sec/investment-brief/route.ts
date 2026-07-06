/**
 * SEC investment brief endpoint.
 *
 * Loads a filing by identity, parses sections, and generates
 * an investment decision brief with reasoning trace.
 */
import { z } from "zod";
import { getRequestIdFromHeaders, withRequestIdHeader } from "@/lib/request-id";
import {
  createFilingNotFoundResponse,
  toSecApiErrorResponse,
} from "@/lib/sec/api-response";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { buildInvestmentDecisionBriefFromFiling } from "@/lib/sec/investment-brief";
import { getFilingByIdentity } from "@/lib/sec/repository";
import {
  parseSecJsonBody,
  requireSecApiUser,
} from "@/lib/sec/route-helpers";

const bodySchema = z.object({
  cik: z.string().trim().min(1),
  accessionNo: z.string().trim().min(1),
  riskTolerance: z.string().trim().optional(),
  timeHorizon: z.string().trim().optional(),
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

    const result = await buildInvestmentDecisionBriefFromFiling({
      companyName: filing.companyName,
      formType: filing.formType,
      filingDate: filing.filingDate,
      sections: document.sections,
      riskTolerance: body.riskTolerance,
      timeHorizon: body.timeHorizon,
    });

    return withRequestIdHeader(
      Response.json({
        filing,
        brief: result.brief,
        reasoningTrace: result.reasoningTrace,
      }),
      requestId
    );
  } catch (error) {
    return toSecApiErrorResponse(error, requestId);
  }
}
