import { ChatSDKError } from "@/lib/errors";

export type SecApiErrorCode =
  | "sec_bad_request"
  | "sec_collector_unavailable"
  | "sec_company_not_found"
  | "sec_filing_not_found"
  | "sec_local_file_unavailable"
  | "sec_unexpected_error";

export type SecApiProblem = {
  code: SecApiErrorCode;
  message: string;
  cause?: string;
  recovery?: string;
  requestId?: string;
};

type SecApiErrorResponseInput = SecApiProblem & {
  status: number;
};

type SecApiProblemLogInput = Pick<
  SecApiErrorResponseInput,
  "cause" | "code" | "recovery" | "requestId" | "status"
>;

const COLLECTOR_RECOVERY =
  "Start infra and the collector database, then run `pnpm run infra:up` and retry. If the database is empty, run collector company and filing sync jobs.";

const LOCAL_FILE_RECOVERY =
  "Run collector metadata sync and download jobs: `pnpm --filter @10k/collector run companies:sync`, then `pnpm --filter @10k/collector run filings:collect -- --limit-companies 100 --since 2025-01-01 --max-files 200`.";

export function formatSecApiProblemLog({
  cause,
  code,
  recovery,
  requestId,
  status,
}: SecApiProblemLogInput) {
  return JSON.stringify({
    event: "sec_api_problem",
    code,
    status,
    ...(requestId ? { requestId } : {}),
    hasCause: Boolean(cause),
    hasRecovery: Boolean(recovery),
  });
}

function logSecApiProblem(input: SecApiProblemLogInput) {
  if (process.env.SEC_API_PROBLEM_LOGS === "off") {
    return;
  }

  console.warn(formatSecApiProblemLog(input));
}

export function createSecApiErrorResponse({
  code,
  message,
  cause,
  recovery,
  requestId,
  status,
}: SecApiErrorResponseInput) {
  const problem: SecApiProblem = {
    code,
    message,
    ...(cause ? { cause } : {}),
    ...(recovery ? { recovery } : {}),
    ...(requestId ? { requestId } : {}),
  };

  logSecApiProblem({ cause, code, recovery, requestId, status });

  return Response.json(
    {
      error: problem,
      code,
      message,
      ...(cause ? { cause } : {}),
      ...(recovery ? { recovery } : {}),
      ...(requestId ? { requestId } : {}),
    },
    {
      headers: requestId ? { "x-request-id": requestId } : undefined,
      status,
    }
  );
}

function getErrorCause(error: ChatSDKError) {
  return typeof error.cause === "string" ? error.cause : undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || String(error.cause ?? "");
  }

  return String(error);
}

function isCollectorDependencyError(error: unknown) {
  const message = getErrorMessage(error);

  return /COLLECTOR_DATABASE_URL|POSTGRES_URL|ECONNREFUSED|ECONNRESET|ENOTFOUND|timeout|database .* does not exist|password authentication failed|connection terminated|postgres/i.test(
    message
  );
}

function isLocalFileError(cause: string | undefined) {
  return (
    !!cause &&
    (/No local file path/i.test(cause) ||
      /Failed to read filing file/i.test(cause))
  );
}

export function toSecApiErrorResponse(error: unknown, requestId?: string) {
  if (error instanceof ChatSDKError) {
    const cause = getErrorCause(error);

    if (isLocalFileError(cause)) {
      return createSecApiErrorResponse({
        status: 409,
        code: "sec_local_file_unavailable",
        message:
          "The filing metadata exists, but the downloaded local filing file is not available.",
        cause,
        recovery: LOCAL_FILE_RECOVERY,
        requestId,
      });
    }

    if (isCollectorDependencyError(cause ?? error)) {
      return createSecApiErrorResponse({
        status: 503,
        code: "sec_collector_unavailable",
        message:
          "The SEC collector database is not configured or cannot be reached.",
        cause,
        recovery: COLLECTOR_RECOVERY,
        requestId,
      });
    }

    return createSecApiErrorResponse({
      status: error.statusCode,
      code: "sec_bad_request",
      message: error.message,
      cause,
      recovery:
        error.type === "bad_request"
          ? "Check the request parameters and retry."
          : undefined,
      requestId,
    });
  }

  if (isCollectorDependencyError(error)) {
    return createSecApiErrorResponse({
      status: 503,
      code: "sec_collector_unavailable",
      message: "The SEC collector database is not reachable.",
      recovery: COLLECTOR_RECOVERY,
      requestId,
    });
  }

  return createSecApiErrorResponse({
    status: 500,
    code: "sec_unexpected_error",
    message: "The SEC API request failed unexpectedly.",
    recovery: "Check the Next.js server logs, then retry the request.",
    requestId,
  });
}

export function createCompanyNotFoundResponse(
  companyQuery: string,
  requestId?: string
) {
  return createSecApiErrorResponse({
    status: 404,
    code: "sec_company_not_found",
    message: `No SEC company match was found for "${companyQuery}".`,
    cause:
      "The collector company table has no matching ticker, company name, or CIK.",
    recovery:
      "Try a ticker or 10-digit CIK. If this should exist, run `pnpm --filter @10k/collector run companies:sync`.",
    requestId,
  });
}

export function createFilingNotFoundResponse({
  companyQuery,
  accessionNo,
  requestId,
}: {
  companyQuery?: string;
  accessionNo?: string;
  requestId?: string;
}) {
  const target = accessionNo
    ? `accession ${accessionNo}`
    : `company query "${companyQuery ?? "unknown"}"`;

  return createSecApiErrorResponse({
    status: 404,
    code: "sec_filing_not_found",
    message: `No SEC filing was found for ${target}.`,
    cause: "The collector filing metadata table has no matching filing.",
    recovery:
      "Run the collector filing metadata sync and download jobs, then retry this request.",
    requestId,
  });
}

export function createNoFilingsNotice(
  companyQuery: string,
  forms?: string[],
  requestId?: string
) {
  return {
    code: "sec_filing_not_found" as const,
    message: `No filings matched "${companyQuery}"${forms?.length ? ` for forms ${forms.join(", ")}` : ""}.`,
    cause:
      "The company exists, but the collector returned no filing rows for the current filters.",
    recovery:
      "Loosen the form filter or run collector filing metadata and download jobs for the company.",
    ...(requestId ? { requestId } : {}),
  };
}
