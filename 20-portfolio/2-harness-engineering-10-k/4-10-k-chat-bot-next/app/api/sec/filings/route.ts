/**
 * SEC filings list endpoint.
 *
 * Authenticated wrapper around repository.listCompanyFilings.
 */
import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";
import { getRequestIdFromHeaders, withRequestIdHeader } from "@/lib/request-id";
import {
  createCompanyNotFoundResponse,
  createNoFilingsNotice,
  toSecApiErrorResponse,
} from "@/lib/sec/api-response";
import { listCompanyFilings } from "@/lib/sec/repository";

function parseBoundedInteger({
  value,
  fallback,
  min,
  max,
}: {
  value: string | null;
  fallback: number;
  min: number;
  max: number;
}) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const session = await auth();

  if (!session?.user) {
    return withRequestIdHeader(
      new ChatSDKError("unauthorized:chat").toResponse(),
      requestId
    );
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
