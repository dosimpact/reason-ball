/**
 * SEC filings list endpoint.
 *
 * Authenticated wrapper around repository.listCompanyFilings.
 */
import type { NextRequest } from "next/server";
import { ChatSDKError } from "@/lib/errors";
import { getRequestIdFromHeaders, withRequestIdHeader } from "@/lib/request-id";
import {
  createCompanyNotFoundResponse,
  createNoFilingsNotice,
  toSecApiErrorResponse,
} from "@/lib/sec/api-response";
import { listCompanyFilings } from "@/lib/sec/repository";
import {
  parseBoundedInteger,
  requireSecApiUser,
} from "@/lib/sec/route-helpers";

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const authError = await requireSecApiUser(requestId);
  if (authError) {
    return authError;
  }

  const companyQuery = request.nextUrl.searchParams.get("companyQuery")?.trim();
  const formsValue = request.nextUrl.searchParams.get("forms")?.trim();

  if (!companyQuery) {
    return toSecApiErrorResponse(
      new ChatSDKError("bad_request:api", "companyQuery is required"),
      requestId
    );
  }

  const forms = formsValue
    ? formsValue
        .split(",")
        .map((form) => form.trim())
        .filter(Boolean)
    : undefined;

  try {
    const result = await listCompanyFilings({
      companyQuery,
      forms,
      limit: parseBoundedInteger({
        value: request.nextUrl.searchParams.get("limit"),
        fallback: 10,
        min: 1,
        max: 50,
      }),
      cursor: parseBoundedInteger({
        value: request.nextUrl.searchParams.get("cursor"),
        fallback: 0,
        min: 0,
        max: 10_000,
      }),
    });

    if (!result) {
      return createCompanyNotFoundResponse(companyQuery, requestId);
    }

    if (result.filings.length === 0) {
      return withRequestIdHeader(
        Response.json({
          ...result,
          notice: createNoFilingsNotice(companyQuery, forms, requestId),
        }),
        requestId
      );
    }

    return withRequestIdHeader(Response.json(result), requestId);
  } catch (error) {
    return toSecApiErrorResponse(error, requestId);
  }
}
