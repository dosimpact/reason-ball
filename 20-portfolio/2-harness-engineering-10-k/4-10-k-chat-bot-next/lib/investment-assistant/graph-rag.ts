import "server-only";

import { ChatSDKError } from "@/lib/errors";
import type {
  FilingSelectionState,
  GraphEvidence,
} from "@/lib/investment-assistant/types";

export type GraphRagQueryInput = {
  query: string;
  companyQuery?: string | null;
  ticker?: string | null;
  cik?: string | null;
  accessionNo?: string | null;
  filingId?: string | null;
  selectedFiling?: Partial<FilingSelectionState> | null;
  evidenceLimit?: number;
};

export type GraphRagQueryResult = {
  intent: string | null;
  selectedFiling: {
    filingId: string | null;
    accessionNo: string | null;
    companyName: string | null;
    ticker: string | null;
    cik: string | null;
    formType: string | null;
    filingDate: string | null;
  } | null;
  answer: string | null;
  evidenceBundle: GraphEvidence[];
};

const HTML_TAG_REGEX = /<[^>]+>/g;
const NUMERIC_ENTITY_REGEX = /&#(\d+);/g;

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(NUMERIC_ENTITY_REGEX, (_, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    });
}

function sanitizeGraphText(input: string | null | undefined) {
  if (!input) {
    return "";
  }

  return decodeHtmlEntities(input)
    .replace(HTML_TAG_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function requireParserBackendBaseUrl() {
  const baseUrl = process.env.PARSER_BACKEND_URL?.trim();

  if (!baseUrl) {
    throw new ChatSDKError(
      "bad_request:api",
      "PARSER_BACKEND_URL is required for Graph RAG integration"
    );
  }

  return baseUrl;
}

function isTruthyEnv(value: string | undefined) {
  return value?.toLowerCase() === "true";
}

function shouldSimulateGraphRagFailure(query: string) {
  const failureHooksEnabled =
    isTruthyEnv(process.env.INVESTMENT_ASSISTANT_E2E_FAILURE_HOOKS) ||
    isTruthyEnv(process.env.PLAYWRIGHT);

  return (
    failureHooksEnabled && query.includes("__simulate_graph_rag_unavailable__")
  );
}

export async function queryGraphRag(
  input: GraphRagQueryInput
): Promise<GraphRagQueryResult> {
  if (shouldSimulateGraphRagFailure(input.query)) {
    throw new ChatSDKError(
      "bad_request:api",
      "Simulated Graph RAG failure for e2e coverage"
    );
  }

  const baseUrl = requireParserBackendBaseUrl();
  const response = await fetch(`${baseUrl}/api/graph-rag/query`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: input.query,
      companyQuery: input.companyQuery ?? undefined,
      selectedFiling: input.selectedFiling ?? undefined,
      ticker: input.ticker ?? undefined,
      cik: input.cik ?? undefined,
      accessionNo: input.accessionNo ?? undefined,
      filingId: input.filingId ?? undefined,
      evidenceLimit: input.evidenceLimit ?? 8,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ChatSDKError(
      "bad_request:api",
      `Graph RAG request failed (${response.status}): ${body || "unknown error"}`
    );
  }

  const payload = (await response.json()) as GraphRagQueryResult;

  return {
    intent: payload.intent ?? null,
    selectedFiling: payload.selectedFiling ?? null,
    answer: sanitizeGraphText(payload.answer),
    evidenceBundle: Array.isArray(payload.evidenceBundle)
      ? payload.evidenceBundle.map((evidence) => ({
          ...evidence,
          text: sanitizeGraphText(evidence.text),
        }))
      : [],
  };
}
