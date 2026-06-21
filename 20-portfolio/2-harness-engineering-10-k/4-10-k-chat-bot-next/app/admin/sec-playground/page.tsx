"use client";

import { useMemo, useState } from "react";

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

type Filing = {
  cik: string;
  accessionNo: string;
  formType: string;
  filingDate: string | null;
  companyName: string;
  ticker: string | null;
};

type SecApiProblem = {
  code?: string;
  message: string;
  cause?: string;
  recovery?: string;
};

type FilingsResponse = {
  filings?: Filing[];
  notice?: SecApiProblem;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function extractApiProblem(
  payload: unknown,
  fallbackMessage: string
): SecApiProblem {
  const root = isRecord(payload) ? payload : {};
  const nestedError = isRecord(root.error) ? root.error : root;

  return {
    code: stringField(nestedError.code),
    message:
      stringField(nestedError.message) ??
      stringField(nestedError.cause) ??
      fallbackMessage,
    cause: stringField(nestedError.cause),
    recovery: stringField(nestedError.recovery),
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function ApiProblemPanel({
  problem,
  tone,
}: {
  problem: SecApiProblem;
  tone: "error" | "warning";
}) {
  const className =
    tone === "error"
      ? "rounded border border-red-300 bg-red-50 p-3 text-red-700 text-sm"
      : "rounded border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm";

  return (
    <div className={className} role="alert">
      <div className="font-medium">{problem.message}</div>
      {problem.code && (
        <div className="mt-1 text-xs">
          Code: <code>{problem.code}</code>
        </div>
      )}
      {problem.cause && (
        <div className="mt-1 text-xs">Cause: {problem.cause}</div>
      )}
      {problem.recovery && (
        <div className="mt-1 text-xs">Recovery: {problem.recovery}</div>
      )}
    </div>
  );
}

export default function SecPlaygroundPage() {
  const [companyQuery, setCompanyQuery] = useState("AAPL");
  const [targetPeriod, setTargetPeriod] = useState<
    "annual" | "quarterly" | "auto"
  >("quarterly");
  const [style, setStyle] = useState<
    "executive" | "short" | "risk_focus" | "key_info_first"
  >("key_info_first");

  const [filingsResponse, setFilingsResponse] =
    useState<FilingsResponse | null>(null);
  const [fullTextResponse, setFullTextResponse] = useState<unknown>(null);
  const [summaryResponse, setSummaryResponse] = useState<unknown>(null);
  const [briefResponse, setBriefResponse] = useState<unknown>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [apiProblem, setApiProblem] = useState<SecApiProblem | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filings: Filing[] = useMemo(
    () =>
      Array.isArray(filingsResponse?.filings) ? filingsResponse.filings : [],
    [filingsResponse]
  );

  const selectedFiling = filings[0] ?? null;
  const normalizedCompanyQuery = companyQuery.trim();

  function clearLoadedResponses() {
    setFilingsResponse(null);
    setFullTextResponse(null);
    setSummaryResponse(null);
    setBriefResponse(null);
    setStatusMessage(null);
  }

  function handleCompanyQueryChange(value: string) {
    setCompanyQuery(value);
    setApiProblem(null);
    clearLoadedResponses();
  }

  function requireCompanyQuery() {
    if (normalizedCompanyQuery) {
      return normalizedCompanyQuery;
    }

    clearLoadedResponses();
    setApiProblem({
      code: "sec_bad_request",
      message: "Company is required.",
      recovery: "Enter a ticker, CIK, or company name, then retry.",
    });
    return null;
  }

  async function callApi<T>(name: string, request: () => Promise<Response>) {
    setLoadingAction(name);
    setApiProblem(null);
    setStatusMessage(null);

    try {
      const response = await request();
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setApiProblem(
          extractApiProblem(payload, `Failed to run ${name} request`)
        );
        return null;
      }

      setStatusMessage(`${name} completed (${response.status})`);
      return payload as T;
    } catch (apiError) {
      setApiProblem({
        code: "network_error",
        message:
          apiError instanceof Error ? apiError.message : String(apiError),
        recovery:
          "Check that the Next.js server is running and retry the request.",
      });
      return null;
    } finally {
      setLoadingAction(null);
    }
  }

  async function fetchFilings() {
    const query = requireCompanyQuery();

    if (!query) {
      return;
    }

    clearLoadedResponses();
    const result = await callApi<FilingsResponse>("filings", async () =>
      fetch(
        `/api/sec/filings?companyQuery=${encodeURIComponent(query)}&limit=20`
      )
    );

    if (result) {
      setFilingsResponse(result);
    }
  }

  async function fetchFullText() {
    const query = requireCompanyQuery();

    if (!query) {
      return;
    }

    setFullTextResponse(null);
    const result = await callApi("full-text", async () =>
      fetch("/api/sec/full-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyQuery: query,
          targetPeriod,
        }),
      })
    );

    if (result) {
      setFullTextResponse(result);
    }
  }

  async function fetchSummary() {
    if (!selectedFiling) {
      setSummaryResponse(null);
      setApiProblem({
        code: "sec_no_selected_filing",
        message: "Run filings list first so a filing can be selected.",
        recovery:
          "Click Filings, confirm at least one row is returned, then retry Summary.",
      });
      return;
    }

    setSummaryResponse(null);
    const result = await callApi("summary", async () =>
      fetch("/api/sec/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cik: selectedFiling.cik,
          accessionNo: selectedFiling.accessionNo,
          style,
        }),
      })
    );

    if (result) {
      setSummaryResponse(result);
    }
  }

  async function fetchBrief() {
    if (!selectedFiling) {
      setBriefResponse(null);
      setApiProblem({
        code: "sec_no_selected_filing",
        message: "Run filings list first so a filing can be selected.",
        recovery:
          "Click Filings, confirm at least one row is returned, then retry Brief.",
      });
      return;
    }

    setBriefResponse(null);
    const result = await callApi("investment-brief", async () =>
      fetch("/api/sec/investment-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cik: selectedFiling.cik,
          accessionNo: selectedFiling.accessionNo,
        }),
      })
    );

    if (result) {
      setBriefResponse(result);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      <h1 className="font-semibold text-2xl">SEC Playground (Admin)</h1>
      <p className="text-muted-foreground text-sm">
        API and feature smoke tests for filing list, full-text load, summary,
        and investment brief.
      </p>

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs">Company</span>
          <input
            className="rounded border bg-background px-2 py-1 text-sm"
            onChange={(event) => handleCompanyQueryChange(event.target.value)}
            value={companyQuery}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs">Target Period</span>
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            onChange={(event) =>
              setTargetPeriod(
                event.target.value as "annual" | "quarterly" | "auto"
              )
            }
            value={targetPeriod}
          >
            <option value="auto">auto</option>
            <option value="quarterly">quarterly</option>
            <option value="annual">annual</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs">Summary Style</span>
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            onChange={(event) =>
              setStyle(
                event.target.value as
                  | "executive"
                  | "short"
                  | "risk_focus"
                  | "key_info_first"
              )
            }
            value={style}
          >
            <option value="key_info_first">key_info_first</option>
            <option value="executive">executive</option>
            <option value="short">short</option>
            <option value="risk_focus">risk_focus</option>
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <button
            className="rounded bg-foreground px-3 py-1 text-background text-sm"
            disabled={loadingAction !== null}
            onClick={fetchFilings}
            type="button"
          >
            1) Filings
          </button>
          <button
            className="rounded bg-foreground px-3 py-1 text-background text-sm"
            disabled={loadingAction !== null}
            onClick={fetchFullText}
            type="button"
          >
            2) Full Text
          </button>
          <button
            className="rounded bg-foreground px-3 py-1 text-background text-sm"
            disabled={loadingAction !== null}
            onClick={fetchSummary}
            type="button"
          >
            3) Summary
          </button>
          <button
            className="rounded bg-foreground px-3 py-1 text-background text-sm"
            disabled={loadingAction !== null}
            onClick={fetchBrief}
            type="button"
          >
            4) Brief
          </button>
        </div>
      </div>

      {loadingAction && (
        <div className="rounded border bg-muted/30 p-2 text-sm">
          Running: {loadingAction}
        </div>
      )}
      {statusMessage && !apiProblem && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-emerald-700 text-sm">
          {statusMessage}
        </div>
      )}
      {apiProblem && <ApiProblemPanel problem={apiProblem} tone="error" />}
      {filingsResponse?.notice && (
        <ApiProblemPanel problem={filingsResponse.notice} tone="warning" />
      )}
      {filingsResponse && filings.length === 0 && !filingsResponse.notice && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm">
          No filing rows are available for the current company and filters. Run
          collector filing metadata and download jobs, then retry this page.
        </div>
      )}

      {selectedFiling && (
        <div className="rounded border bg-muted/20 p-3 text-sm">
          <div className="font-medium">Selected filing for summary/brief</div>
          <div>
            {selectedFiling.companyName} ({selectedFiling.ticker ?? "N/A"}) -{" "}
            {selectedFiling.formType} - {selectedFiling.filingDate ?? "unknown"}
          </div>
          <div className="text-xs">{selectedFiling.accessionNo}</div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border p-3">
          <h2 className="mb-2 font-medium text-sm">Filings Response</h2>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
            {prettyJson(filingsResponse)}
          </pre>
        </section>
        <section className="rounded border p-3">
          <h2 className="mb-2 font-medium text-sm">Full Text Response</h2>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
            {prettyJson(fullTextResponse)}
          </pre>
        </section>
        <section className="rounded border p-3">
          <h2 className="mb-2 font-medium text-sm">Summary Response</h2>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
            {prettyJson(summaryResponse)}
          </pre>
        </section>
        <section className="rounded border p-3">
          <h2 className="mb-2 font-medium text-sm">
            Investment Brief Response
          </h2>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
            {prettyJson(briefResponse)}
          </pre>
        </section>
      </div>
    </div>
  );
}
