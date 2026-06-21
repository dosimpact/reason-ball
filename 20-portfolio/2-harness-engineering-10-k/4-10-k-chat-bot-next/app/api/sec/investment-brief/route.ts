/**
 * SEC investment brief endpoint.
 *
 * Loads a filing by identity, parses sections, and generates
 * an investment decision brief with reasoning trace.
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
import { buildInvestmentDecisionBriefFromFiling } from "@/lib/sec/investment-brief";
import { getFilingByIdentity } from "@/lib/sec/repository";

const bodySchema = z.object({
  cik: z.string().trim().min(1),
  accessionNo: z.string().trim().min(1),
  riskTolerance: z.string().trim().optional(),
  timeHorizon: z.string().trim().optional(),
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
