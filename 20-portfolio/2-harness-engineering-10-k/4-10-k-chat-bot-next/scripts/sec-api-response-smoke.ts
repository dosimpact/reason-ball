import { ChatSDKError } from "@/lib/errors";
import {
  createCompanyNotFoundResponse,
  createFilingNotFoundResponse,
  createNoFilingsNotice,
  formatSecApiProblemLog,
  toSecApiErrorResponse,
} from "@/lib/sec/api-response";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function readProblem(response: Response) {
  const body = (await response.json()) as {
    error?: {
      code?: string;
      message?: string;
      cause?: string;
      recovery?: string;
      requestId?: string;
    };
  };

  invariant(body.error, "response should include nested error payload");
  return body.error;
}

function readStructuredWarnings(messages: string[]) {
  return messages.flatMap((message) => {
    try {
      return [JSON.parse(message) as Record<string, unknown>];
    } catch {
      return [];
    }
  });
}

async function runAssertions(warningMessages: string[]) {
  const companyNotFound = createCompanyNotFoundResponse(
    "NO_SUCH_TICKER",
    "req-smoke"
  );
  invariant(companyNotFound.status === 404, "company miss should be 404");
  invariant(
    companyNotFound.headers.get("x-request-id") === "req-smoke",
    "company miss should echo request id header"
  );
  const companyProblem = await readProblem(companyNotFound);
  invariant(
    companyProblem.requestId === "req-smoke",
    "company miss should include request id"
  );
  invariant(
    companyProblem.code === "sec_company_not_found",
    "company miss should use stable error code"
  );
  const structuredWarnings = readStructuredWarnings(warningMessages);
  const companyWarning = structuredWarnings.find(
    (entry) =>
      entry.event === "sec_api_problem" && entry.requestId === "req-smoke"
  );
  invariant(
    companyWarning?.code === "sec_company_not_found",
    "company miss should log stable error code with request id"
  );
  invariant(
    companyWarning.status === 404,
    "company miss log should include status"
  );
  invariant(
    companyWarning.hasRecovery === true,
    "company miss log should flag recovery guidance"
  );
  invariant(
    /companies:sync/.test(companyProblem.recovery ?? ""),
    "company miss should include collector company sync recovery"
  );

  const sampleLog = JSON.parse(
    formatSecApiProblemLog({
      code: "sec_bad_request",
      status: 400,
      requestId: "req-format",
      recovery: "retry",
    })
  ) as Record<string, unknown>;
  invariant(
    sampleLog.event === "sec_api_problem",
    "problem log should name event"
  );
  invariant(
    sampleLog.requestId === "req-format",
    "problem log should include request id"
  );
  invariant(
    sampleLog.hasCause === false,
    "problem log should avoid raw cause values"
  );

  const badRequest = toSecApiErrorResponse(
    new ChatSDKError("bad_request:api", "Invalid request body"),
    "req-bad-request"
  );
  invariant(badRequest.status === 400, "bad request should be 400");
  invariant(
    badRequest.headers.get("x-request-id") === "req-bad-request",
    "bad request should echo request id header"
  );
  const badRequestProblem = await readProblem(badRequest);
  invariant(
    badRequestProblem.code === "sec_bad_request",
    "bad request should use stable SEC error code"
  );
  invariant(
    badRequestProblem.requestId === "req-bad-request",
    "bad request should include request id"
  );
  invariant(
    /request parameters/i.test(badRequestProblem.recovery ?? ""),
    "bad request should include parameter recovery"
  );

  const filingNotFound = createFilingNotFoundResponse({
    accessionNo: "0000000000-00-000000",
  });
  invariant(filingNotFound.status === 404, "filing miss should be 404");
  const filingProblem = await readProblem(filingNotFound);
  invariant(
    filingProblem.code === "sec_filing_not_found",
    "filing miss should use stable error code"
  );
  invariant(
    /metadata sync/i.test(filingProblem.recovery ?? ""),
    "filing miss should include metadata sync recovery"
  );

  const localFileError = toSecApiErrorResponse(
    new ChatSDKError(
      "bad_request:api",
      "No local file path for accession 0000000000-00-000000"
    )
  );
  invariant(localFileError.status === 409, "missing file should be 409");
  const localFileProblem = await readProblem(localFileError);
  invariant(
    localFileProblem.code === "sec_local_file_unavailable",
    "missing file should use stable error code"
  );
  invariant(
    /filings:collect/.test(localFileProblem.recovery ?? ""),
    "missing file should include collector download recovery"
  );

  const collectorError = toSecApiErrorResponse(
    new ChatSDKError(
      "bad_request:api",
      "COLLECTOR_DATABASE_URL or POSTGRES_URL is required"
    )
  );
  invariant(
    collectorError.status === 503,
    "collector config miss should be 503"
  );
  const collectorProblem = await readProblem(collectorError);
  invariant(
    collectorProblem.code === "sec_collector_unavailable",
    "collector miss should use stable error code"
  );
  invariant(
    /infra:up/.test(collectorProblem.recovery ?? ""),
    "collector miss should include infra recovery"
  );

  const notice = createNoFilingsNotice("AAPL", ["8-K"]);
  invariant(
    notice.code === "sec_filing_not_found",
    "empty filing notice should use filing-not-found code"
  );
  invariant(
    /Loosen the form filter/i.test(notice.recovery),
    "empty filing notice should guide filter recovery"
  );
}

async function main() {
  const warningMessages: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message?: unknown, ...optionalParams: unknown[]) => {
    warningMessages.push(
      [message, ...optionalParams].map((value) => String(value)).join(" ")
    );
  };

  try {
    await runAssertions(warningMessages);
  } finally {
    console.warn = originalWarn;
  }

  console.log("SEC API response contract smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
