import "server-only";

import { buildInvestmentDashboard } from "@/lib/investment-assistant/dashboard";
import { buildDecisionQuality } from "@/lib/investment-assistant/decision-quality";
import {
  type GraphRagQueryResult,
  queryGraphRag,
} from "@/lib/investment-assistant/graph-rag";
import {
  appendRuntimeIssue,
  clearRuntimeIssues,
  createRuntimeIssue,
  normalizeRuntimeState,
} from "@/lib/investment-assistant/runtime";
import {
  emptyInvestmentAssistantState,
  type FilingListItem,
  type FilingProvenanceState,
  type FilingSelectionState,
  type InvestmentAssistantRuntimeIssue,
  type InvestmentAssistantRuntimeIssueSource,
  type InvestmentAssistantState,
  normalizeInvestmentA2UISurface,
} from "@/lib/investment-assistant/types";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { buildInvestmentDecisionBriefFromFiling } from "@/lib/sec/investment-brief";
import { getFilingByIdentity, listCompanyFilings } from "@/lib/sec/repository";
import type { FilingRecord } from "@/lib/sec/types";

const FORM_REGEX = /\b(10-K|10-Q|20-F|6-K)\b/gi;
const CIK_REGEX = /\b\d{10}\b/;
const QUOTED_COMPANY_REGEX = /["“”]([^"“”]{2,80})["“”]/g;
const UPPERCASE_TICKER_REGEX = /\b[A-Z]{1,5}\b/g;
const WORD_REGEX = /[A-Za-z][A-Za-z0-9.&'-]*/g;
const TITLE_CASE_WORD_REGEX = /^[A-Z][A-Za-z0-9.&'-]*$/;
const UPPERCASE_WORD_REGEX = /^[A-Z]{1,5}$/;
const FILING_FRESHNESS_STALE_AFTER_DAYS = 14;
const E2E_STALE_FILING_FRESHNESS_DAYS = FILING_FRESHNESS_STALE_AFTER_DAYS + 7;
const EXCLUDED_WORDS = new Set([
  "SHOW",
  "OPEN",
  "LIST",
  "LATEST",
  "RECENT",
  "PLEASE",
  "SUMMARY",
  "SUMMARIZE",
  "SUMMARISE",
  "BRIEF",
  "BUILD",
  "EXPLAIN",
  "ANALYZE",
  "ANALYSE",
  "COMPARE",
  "REVIEW",
  "USING",
  "USE",
  "THE",
  "A",
  "AN",
  "ITS",
  "THEIR",
  "THIS",
  "THAT",
  "MY",
  "OUR",
  "FOCUS",
  "WHETHER",
  "SELECTED",
  "CURRENT",
  "SAME",
  "PREVIOUS",
  "PREVIOUSLY",
  "CONTEXT",
  "AGAIN",
  "REFRESH",
  "WORKSPACE",
  "SNAPSHOT",
  "SIMULATE",
  "LOOKUP",
  "UNAVAILABLE",
  "MAIN",
  "KEY",
  "LOOK",
  "LOOKS",
  "LOOKING",
  "CAUTIOUS",
  "THESIS",
  "BULL",
  "BEAR",
  "SEC",
  "FILING",
  "FILINGS",
  "FORM",
  "ITEM",
  "RISK",
  "RISKS",
  "METRIC",
  "METRICS",
  "REPORT",
  "LATEST",
  "ANNUAL",
  "QUARTERLY",
  "INVESTMENT",
]);
const MARKER_WORDS = new Set([
  "about",
  "for",
  "on",
  "regarding",
  "show",
  "open",
  "summarize",
  "summarise",
  "analyze",
  "analyse",
  "review",
  "explain",
  "compare",
]);
const SKIPPABLE_PREFIX_WORDS = new Set([
  "a",
  "an",
  "the",
  "its",
  "their",
  "this",
  "that",
  "my",
  "our",
]);
const EXTRACTION_STOP_WORDS = new Set([
  "annual",
  "again",
  "and",
  "a",
  "an",
  "brief",
  "business",
  "cautious",
  "changes",
  "context",
  "current",
  "decision",
  "explain",
  "filing",
  "filings",
  "focus",
  "form",
  "framework",
  "give",
  "item",
  "items",
  "key",
  "latest",
  "list",
  "main",
  "metric",
  "metrics",
  "open",
  "outlook",
  "please",
  "previous",
  "previously",
  "quarterly",
  "recent",
  "refresh",
  "report",
  "risks",
  "risk",
  "same",
  "selected",
  "show",
  "simulate",
  "snapshot",
  "stance",
  "summarize",
  "summary",
  "that",
  "the",
  "their",
  "thesis",
  "unavailable",
  "using",
  "its",
  "whether",
  "with",
  "workspace",
  "lookup",
  "my",
  "our",
]);

function createFallbackFilingProvenanceState(
  filingUrl: string | null | undefined
): FilingProvenanceState {
  return {
    dataSource: "collector-database",
    documentSource: filingUrl ? "sec-archive-url" : "metadata-only",
    collectorUpdatedAt: null,
    parserStatus: null,
    isDownloaded: false,
    hasLocalFile: false,
    freshnessStatus: "unknown",
    freshnessDetail: "Collector update timestamp is unavailable.",
    refreshHint:
      "Run the collector metadata and download jobs before relying on this filing as the latest available data.",
  };
}

function normalizeFilingProvenanceState(
  provenance: Partial<FilingProvenanceState> | null | undefined,
  filingUrl: string | null | undefined
): FilingProvenanceState {
  const fallback = createFallbackFilingProvenanceState(filingUrl);

  return {
    ...fallback,
    ...provenance,
    freshnessStatus: provenance?.freshnessStatus ?? fallback.freshnessStatus,
    freshnessDetail: provenance?.freshnessDetail ?? fallback.freshnessDetail,
    refreshHint: provenance?.refreshHint ?? fallback.refreshHint,
  };
}

function normalizeFilingSelectionState(
  filing: FilingSelectionState
): FilingSelectionState {
  return {
    ...filing,
    provenance: normalizeFilingProvenanceState(
      (filing as Partial<FilingSelectionState>).provenance,
      filing.filingUrl
    ),
  };
}

function normalizeFilingListItem(filing: FilingListItem): FilingListItem {
  return {
    ...filing,
    provenance: normalizeFilingProvenanceState(
      (filing as Partial<FilingListItem>).provenance,
      filing.filingUrl
    ),
  };
}

function normalizeState(
  state: Partial<InvestmentAssistantState> | undefined
): InvestmentAssistantState {
  return {
    ...emptyInvestmentAssistantState,
    ...state,
    filings: Array.isArray(state?.filings)
      ? state.filings.map(normalizeFilingListItem)
      : [],
    selectedFiling: state?.selectedFiling
      ? normalizeFilingSelectionState(state.selectedFiling)
      : null,
    reader: state?.reader ?? null,
    graph: state?.graph ?? null,
    brief: state?.brief ?? null,
    decisionQuality: state?.decisionQuality ?? null,
    dashboard: normalizeInvestmentA2UISurface(state?.dashboard),
    runtime: normalizeRuntimeState(state?.runtime),
  };
}

function normalizeCandidateToken(token: string) {
  return token
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "")
    .replace(/(?:'s|’s)$/i, "")
    .trim();
}

function isMeaningfulCompanyWord(word: string) {
  const normalized = normalizeCandidateToken(word);
  if (!normalized) {
    return false;
  }

  return (
    normalized.length >= 2 &&
    !EXCLUDED_WORDS.has(normalized.toUpperCase()) &&
    !MARKER_WORDS.has(normalized.toLowerCase()) &&
    !EXTRACTION_STOP_WORDS.has(normalized.toLowerCase())
  );
}

function pushUniqueCandidate(
  candidates: string[],
  candidate: string | null | undefined
) {
  const normalized = candidate
    ? candidate
        .split(/\s+/)
        .map((part) => normalizeCandidateToken(part))
        .filter(Boolean)
        .join(" ")
        .trim()
    : "";

  if (!normalized) {
    return;
  }

  if (!/^\d{10}$/.test(normalized)) {
    const meaningfulParts = normalized
      .split(/\s+/)
      .filter((part) => isMeaningfulCompanyWord(part));

    if (meaningfulParts.length === 0) {
      return;
    }
  }

  const alreadyPresent = candidates.some(
    (value) => value.toUpperCase() === normalized.toUpperCase()
  );

  if (!alreadyPresent) {
    candidates.push(normalized);
  }
}

function collectCandidateAfterMarker(words: string[], markerIndex: number) {
  const parts: string[] = [];

  for (let index = markerIndex + 1; index < words.length; index += 1) {
    const cleaned = normalizeCandidateToken(words[index]);
    const lowered = cleaned.toLowerCase();

    if (!cleaned) {
      continue;
    }

    if (parts.length === 0 && SKIPPABLE_PREFIX_WORDS.has(lowered)) {
      continue;
    }

    if (!isMeaningfulCompanyWord(cleaned)) {
      if (parts.length === 0) {
        continue;
      }

      break;
    }

    parts.push(cleaned);

    if (parts.length >= 4) {
      break;
    }
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

function isNamedCompanyWord(word: string) {
  const normalized = normalizeCandidateToken(word);
  return (
    isMeaningfulCompanyWord(normalized) &&
    (TITLE_CASE_WORD_REGEX.test(normalized) ||
      UPPERCASE_WORD_REGEX.test(normalized))
  );
}

function extractCompanyQueryCandidates(text: string) {
  const candidates: string[] = [];
  const cik = text.match(CIK_REGEX)?.[0];

  if (cik) {
    return [cik];
  }

  for (const ticker of text.match(UPPERCASE_TICKER_REGEX) ?? []) {
    if (FORM_REGEX.test(ticker)) {
      FORM_REGEX.lastIndex = 0;
      continue;
    }

    pushUniqueCandidate(candidates, ticker);
    FORM_REGEX.lastIndex = 0;
  }

  for (const match of text.matchAll(QUOTED_COMPANY_REGEX)) {
    pushUniqueCandidate(candidates, match[1]);
  }

  const stripped = text.replace(FORM_REGEX, " ");
  const words = stripped.match(WORD_REGEX) ?? [];

  for (let index = 0; index < words.length; index += 1) {
    const lowered = normalizeCandidateToken(words[index]).toLowerCase();
    if (MARKER_WORDS.has(lowered)) {
      pushUniqueCandidate(
        candidates,
        collectCandidateAfterMarker(words, index)
      );
    }
  }

  for (const word of words) {
    if (/(?:'s|’s)$/i.test(word)) {
      pushUniqueCandidate(candidates, normalizeCandidateToken(word));
    }
  }

  for (let index = 0; index < words.length; index += 1) {
    if (!isNamedCompanyWord(words[index])) {
      continue;
    }

    const parts = [normalizeCandidateToken(words[index])];
    let nextIndex = index + 1;

    while (nextIndex < words.length && parts.length < 4) {
      if (!isNamedCompanyWord(words[nextIndex])) {
        break;
      }

      parts.push(normalizeCandidateToken(words[nextIndex]));
      nextIndex += 1;
    }

    pushUniqueCandidate(candidates, parts.join(" "));
    index = nextIndex - 1;
  }

  for (const word of words) {
    if (isMeaningfulCompanyWord(word)) {
      pushUniqueCandidate(candidates, word);
    }
  }

  return candidates;
}

function inferTargetPeriod(text: string): "annual" | "quarterly" | "auto" {
  const lowered = text.toLowerCase();

  if (/10-?q|quarter|분기/.test(lowered)) {
    return "quarterly";
  }

  if (/10-?k|20-?f|annual|사업보고서|연차/.test(lowered)) {
    return "annual";
  }

  return "auto";
}

function wantsFilingList(text: string) {
  return /list|recent filings|filings|목록|최근 공시/.test(text.toLowerCase());
}

function wantsInvestmentBrief(text: string) {
  return /brief|투자|판단|thesis|bull|bear|stance/.test(text.toLowerCase());
}

function isTruthyEnv(value: string | undefined) {
  return value?.toLowerCase() === "true";
}

function shouldSimulateFilingReaderFailure(userMessage: string) {
  const failureHooksEnabled =
    isTruthyEnv(process.env.INVESTMENT_ASSISTANT_E2E_FAILURE_HOOKS) ||
    isTruthyEnv(process.env.PLAYWRIGHT);

  return (
    failureHooksEnabled &&
    userMessage.includes("__simulate_filing_reader_unavailable__")
  );
}

function shouldSimulateFilingCatalogFailure(userMessage: string) {
  const failureHooksEnabled =
    isTruthyEnv(process.env.INVESTMENT_ASSISTANT_E2E_FAILURE_HOOKS) ||
    isTruthyEnv(process.env.PLAYWRIGHT);

  return (
    failureHooksEnabled &&
    userMessage.includes("__simulate_filing_catalog_unavailable__")
  );
}

function shouldSimulateSelectedFilingLookupFailure(userMessage: string) {
  const failureHooksEnabled =
    isTruthyEnv(process.env.INVESTMENT_ASSISTANT_E2E_FAILURE_HOOKS) ||
    isTruthyEnv(process.env.PLAYWRIGHT);

  return (
    failureHooksEnabled &&
    userMessage.includes("__simulate_selected_filing_lookup_unavailable__")
  );
}

function getSimulatedCollectorUpdatedAt(userMessage: string) {
  const failureHooksEnabled =
    isTruthyEnv(process.env.INVESTMENT_ASSISTANT_E2E_FAILURE_HOOKS) ||
    isTruthyEnv(process.env.PLAYWRIGHT);

  if (!failureHooksEnabled) {
    return;
  }

  if (userMessage.includes("__simulate_unknown_filing_freshness__")) {
    return null;
  }

  if (!userMessage.includes("__simulate_stale_filing_freshness__")) {
    return;
  }

  return new Date(
    Date.now() - E2E_STALE_FILING_FRESHNESS_DAYS * 86_400_000
  ).toISOString();
}

function getFilingFreshness(updatedAt: string | null) {
  if (!updatedAt) {
    return {
      freshnessStatus: "unknown" as const,
      freshnessDetail: "Collector update timestamp is unavailable.",
      refreshHint:
        "Run the collector metadata and download jobs before relying on this filing as the latest available data.",
    };
  }

  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) {
    return {
      freshnessStatus: "unknown" as const,
      freshnessDetail: `Collector update timestamp is invalid: ${updatedAt}.`,
      refreshHint:
        "Check the collector database timestamp format, then rerun the collector jobs.",
    };
  }

  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - updated.getTime()) / 86_400_000)
  );

  if (ageDays > FILING_FRESHNESS_STALE_AFTER_DAYS) {
    return {
      freshnessStatus: "stale" as const,
      freshnessDetail: `Collector row was last refreshed ${ageDays} days ago.`,
      refreshHint:
        "Run company sync, filing metadata sync, download, and parser jobs before making a latest-filing decision.",
    };
  }

  return {
    freshnessStatus: "current" as const,
    freshnessDetail:
      ageDays === 0
        ? "Collector row was refreshed today."
        : `Collector row was refreshed ${ageDays} days ago.`,
    refreshHint: null,
  };
}

type FilingProvenanceOptions = {
  collectorUpdatedAt?: string | null;
};

function toFilingProvenanceState(
  filing: FilingRecord,
  options: FilingProvenanceOptions = {}
): FilingProvenanceState {
  const hasLocalFile = Boolean(filing.filePath);
  const isDownloaded = filing.status.toLowerCase() === "downloaded";
  const collectorUpdatedAt =
    "collectorUpdatedAt" in options
      ? (options.collectorUpdatedAt ?? null)
      : filing.updatedAt;
  const freshness = getFilingFreshness(collectorUpdatedAt);

  return {
    dataSource: "collector-database",
    documentSource: hasLocalFile
      ? "downloaded-local-file"
      : filing.filingUrl
        ? "sec-archive-url"
        : "metadata-only",
    collectorUpdatedAt,
    parserStatus: filing.parserStatus || null,
    isDownloaded,
    hasLocalFile,
    ...freshness,
  };
}

function toFilingSelectionState(
  filing: FilingRecord,
  options?: FilingProvenanceOptions
): FilingSelectionState {
  return {
    accessionNo: filing.accessionNo,
    companyName: filing.companyName,
    ticker: filing.ticker,
    cik: filing.cik,
    formType: filing.formType,
    filingDate: filing.filingDate,
    reportDate: filing.reportDate,
    filingUrl: filing.filingUrl,
    provenance: toFilingProvenanceState(filing, options),
  };
}

function toFilingListItem(
  filing: FilingRecord,
  options?: FilingProvenanceOptions
): FilingListItem {
  return {
    accessionNo: filing.accessionNo,
    formType: filing.formType,
    filingDate: filing.filingDate,
    companyName: filing.companyName,
    ticker: filing.ticker,
    cik: filing.cik,
    filingUrl: filing.filingUrl,
    provenance: toFilingProvenanceState(filing, options),
  };
}

function formatDocumentSource(source: FilingProvenanceState["documentSource"]) {
  if (source === "downloaded-local-file") {
    return "downloaded local file";
  }

  if (source === "sec-archive-url") {
    return "SEC archive URL";
  }

  return "metadata only";
}

function formatProvenanceLine(filing: FilingSelectionState) {
  const provenance = filing.provenance;
  const collectorUpdated = provenance.collectorUpdatedAt ?? "unknown";
  const parserStatus = provenance.parserStatus ?? "not parsed";

  return [
    "Data source: Collector DB",
    `document: ${formatDocumentSource(provenance.documentSource)}`,
    `collector updated: ${collectorUpdated}`,
    `parser status: ${parserStatus}`,
    `freshness: ${provenance.freshnessStatus}`,
  ].join("; ");
}

function getErrorDetail(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function recordRuntimeIssue(
  state: InvestmentAssistantState,
  {
    error,
    fallbackDetail,
    recovery,
    severity,
    source,
    title,
  }: {
    error: unknown;
    fallbackDetail: string;
    recovery: string;
    severity?: InvestmentAssistantRuntimeIssue["severity"];
    source: InvestmentAssistantRuntimeIssueSource;
    title: string;
  }
) {
  const detail = getErrorDetail(error, fallbackDetail);
  appendRuntimeIssue(
    state,
    createRuntimeIssue({
      source,
      severity,
      title,
      detail,
      recovery,
    })
  );
  return detail;
}

function pickBestFilingForWorkspace(
  filings: FilingRecord[],
  targetPeriod: "annual" | "quarterly" | "auto"
) {
  const priority =
    targetPeriod === "quarterly"
      ? ["10-Q", "10-Q/A", "10-K", "10-K/A", "20-F", "20-F/A"]
      : targetPeriod === "annual"
        ? ["10-K", "10-K/A", "20-F", "20-F/A", "10-Q", "10-Q/A"]
        : ["10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "20-F/A"];

  for (const formType of priority) {
    const downloaded = filings.find(
      (filing) =>
        filing.formType.toUpperCase() === formType &&
        filing.status === "downloaded" &&
        Boolean(filing.filePath)
    );

    if (downloaded) {
      return downloaded;
    }
  }

  return (
    filings.find(
      (filing) => filing.status === "downloaded" && Boolean(filing.filePath)
    ) ??
    filings[0] ??
    null
  );
}

function composeAssistantResponse({
  userMessage,
  state,
  graphResult,
  graphError,
  filingReadError,
}: {
  userMessage: string;
  state: InvestmentAssistantState;
  graphResult: GraphRagQueryResult | null;
  graphError: string | null;
  filingReadError: string | null;
}) {
  const runtimeIssues = state.runtime.issues;

  if (!state.companyQuery && !state.selectedFiling) {
    const catalogIssue = runtimeIssues.find(
      (issue) => issue.source === "filing-catalog"
    );

    if (catalogIssue) {
      return [
        "I could not reach the filing catalog, so I cannot select a 10-K or 10-Q yet.",
        catalogIssue.recovery,
      ].join("\n");
    }

    return [
      "I need a company, ticker, or CIK to start.",
      "Try examples like: Apple latest 10-K, NVIDIA risk summary, or Tesla investment brief.",
    ].join("\n");
  }

  if (state.companyQuery && !state.selectedFiling) {
    const catalogIssue = runtimeIssues.find(
      (issue) => issue.source === "filing-catalog"
    );

    if (catalogIssue) {
      return [
        `I could not reach the filing catalog for "${state.companyQuery}", so I cannot select a filing yet.`,
        catalogIssue.recovery,
      ].join("\n");
    }

    return [
      `I could not resolve a downloaded filing for "${state.companyQuery}".`,
      "Try a ticker, the official company name, or a 10-digit CIK.",
    ].join("\n");
  }

  const lines: string[] = [];

  if (runtimeIssues.length > 0) {
    lines.push(
      [
        "Runtime status: degraded.",
        ...runtimeIssues.map((issue) => `- ${issue.title}: ${issue.recovery}`),
      ].join("\n")
    );
  }

  if (state.selectedFiling) {
    lines.push(
      `Selected filing: ${state.selectedFiling.companyName} ${state.selectedFiling.formType} (${state.selectedFiling.filingDate ?? "date unknown"}).`
    );
    lines.push(formatProvenanceLine(state.selectedFiling));
    if (state.selectedFiling.provenance.refreshHint) {
      lines.push(
        `Data refresh note: ${state.selectedFiling.provenance.refreshHint}`
      );
    }
  }

  if (state.filings.length > 0 && wantsFilingList(userMessage)) {
    lines.push("Recent filings:");
    for (const filing of state.filings.slice(0, 5)) {
      lines.push(
        `- ${filing.formType} | ${filing.filingDate ?? "unknown"} | ${filing.accessionNo} | parser: ${filing.provenance.parserStatus ?? "not parsed"} | freshness: ${filing.provenance.freshnessStatus}`
      );
    }
  }

  if (graphResult?.answer) {
    lines.push(graphResult.answer);
  } else if (graphError) {
    lines.push(`Graph RAG unavailable: ${graphError}`);
  }

  if (state.brief) {
    lines.push(
      `Investment frame (${state.brief.stance}): ${state.brief.conclusion}`
    );
    if (state.brief.bull.length > 0) {
      lines.push("Bull case:");
      for (const point of state.brief.bull.slice(0, 3)) {
        lines.push(`- ${point}`);
      }
    }
    if (state.brief.bear.length > 0) {
      lines.push("Bear case:");
      for (const point of state.brief.bear.slice(0, 3)) {
        lines.push(`- ${point}`);
      }
    }
    if (state.brief.unknowns.length > 0) {
      lines.push("Unknowns:");
      for (const point of state.brief.unknowns.slice(0, 3)) {
        lines.push(`- ${point}`);
      }
    }
    if (state.decisionQuality) {
      lines.push(state.decisionQuality.summary);
      lines.push("Decision quality checks:");
      for (const check of state.decisionQuality.checks) {
        lines.push(`- ${check.label}: ${check.status} - ${check.detail}`);
      }
    }
    if (state.brief.nextChecks.length > 0) {
      lines.push("Next checks:");
      for (const check of state.brief.nextChecks.slice(0, 3)) {
        lines.push(`- ${check}`);
      }
    }
  }

  if (!graphResult?.answer && state.reader?.preview) {
    lines.push("Reader preview:");
    lines.push(state.reader.preview.slice(0, 700));
  }

  if (filingReadError) {
    lines.push(`Filing reader note: ${filingReadError}`);
  }

  return lines.join("\n\n");
}

export async function runInvestmentAssistantTurn({
  userMessage,
  state,
}: {
  userMessage: string;
  state: Partial<InvestmentAssistantState> | undefined;
}) {
  const nextState = normalizeState(state);
  clearRuntimeIssues(nextState);
  const previousCompanyQuery = nextState.companyQuery;
  const candidateQueries = extractCompanyQueryCandidates(userMessage);
  const hasExplicitCompanyQuery = candidateQueries.length > 0;
  const targetPeriod = inferTargetPeriod(userMessage);
  const queriesToTry = [...candidateQueries];

  if (!hasExplicitCompanyQuery && previousCompanyQuery) {
    pushUniqueCandidate(queriesToTry, previousCompanyQuery);
  }

  let filingListResult: Awaited<ReturnType<typeof listCompanyFilings>> | null =
    null;
  let resolvedCompanyQuery: string | null = null;
  let graphResult: GraphRagQueryResult | null = null;
  let graphError: string | null = null;
  let filingReadError: string | null = null;
  const simulatedCollectorUpdatedAt =
    getSimulatedCollectorUpdatedAt(userMessage);
  const provenanceOptions =
    simulatedCollectorUpdatedAt === undefined
      ? undefined
      : { collectorUpdatedAt: simulatedCollectorUpdatedAt };

  if (queriesToTry.length > 0) {
    for (const companyQuery of queriesToTry) {
      try {
        if (shouldSimulateFilingCatalogFailure(userMessage)) {
          throw new Error("Simulated filing catalog failure for e2e coverage");
        }

        const candidateResult = await listCompanyFilings({
          companyQuery,
          limit: 20,
          cursor: 0,
        });

        if (candidateResult?.filings.length) {
          filingListResult = candidateResult;
          resolvedCompanyQuery =
            candidateResult.company.ticker ??
            candidateResult.company.name ??
            companyQuery;
          break;
        }
      } catch (error) {
        recordRuntimeIssue(nextState, {
          error,
          source: "filing-catalog",
          title: "Filing catalog unavailable",
          fallbackDetail: "filing catalog query failed",
          recovery:
            "Check the workspace PostgreSQL service and collector schema, then retry the request.",
        });
        break;
      }
    }
  }

  const activeCompanyQuery =
    resolvedCompanyQuery ??
    (hasExplicitCompanyQuery
      ? (candidateQueries[0] ?? null)
      : previousCompanyQuery);
  const isNewCompany =
    hasExplicitCompanyQuery && activeCompanyQuery !== previousCompanyQuery;

  nextState.companyQuery = activeCompanyQuery ?? null;
  nextState.lastUserIntent = userMessage;

  let selectedFiling = isNewCompany ? null : nextState.selectedFiling;

  if (filingListResult) {
    nextState.filings =
      filingListResult?.filings
        .slice(0, 5)
        .map((filing) => toFilingListItem(filing, provenanceOptions)) ?? [];

    if (!selectedFiling) {
      const filingCandidate = pickBestFilingForWorkspace(
        filingListResult?.filings ?? [],
        targetPeriod
      );

      if (filingCandidate) {
        selectedFiling = toFilingSelectionState(
          filingCandidate,
          provenanceOptions
        );
      }
    }
  }

  if (selectedFiling) {
    nextState.selectedFiling = selectedFiling;

    let filing: FilingRecord | null = null;

    try {
      if (shouldSimulateSelectedFilingLookupFailure(userMessage)) {
        throw new Error(
          "Simulated selected filing lookup failure for e2e coverage"
        );
      }

      filing = await getFilingByIdentity({
        cik: selectedFiling.cik,
        accessionNo: selectedFiling.accessionNo,
      });
    } catch (error) {
      recordRuntimeIssue(nextState, {
        error,
        source: "filing-catalog",
        title: "Selected filing lookup unavailable",
        fallbackDetail: "selected filing lookup failed",
        recovery:
          "Check the workspace PostgreSQL service before refreshing this filing context.",
      });
    }

    if (filing) {
      nextState.selectedFiling = toFilingSelectionState(
        filing,
        provenanceOptions
      );

      try {
        if (shouldSimulateFilingReaderFailure(userMessage)) {
          throw new Error("Simulated filing reader failure for e2e coverage");
        }

        const document = await loadFilingDocument({ filing });
        nextState.reader = {
          toc: document.toc,
          keyItems: document.keyItems,
          preview: document.markdown.slice(0, 2200),
        };

        if (wantsInvestmentBrief(userMessage) || !nextState.brief) {
          const { brief } = await buildInvestmentDecisionBriefFromFiling({
            companyName: filing.companyName,
            formType: filing.formType,
            filingDate: filing.filingDate,
            sections: document.sections,
          });
          nextState.brief = brief;
        }
      } catch (error) {
        filingReadError = recordRuntimeIssue(nextState, {
          error,
          source: "filing-reader",
          severity: "warning",
          title: "Filing text unavailable",
          fallbackDetail: "failed to load filing text",
          recovery:
            "Verify the collector data directory and downloaded filing file path.",
        });
      }

      try {
        graphResult = await queryGraphRag({
          query: userMessage,
          companyQuery: activeCompanyQuery ?? filing.companyName,
          selectedFiling: filing,
          ticker: filing.ticker,
          cik: filing.cik,
          accessionNo: filing.accessionNo,
          evidenceLimit: 8,
        });

        nextState.graph = {
          intent: graphResult.intent,
          answer: graphResult.answer,
          evidenceBundle: graphResult.evidenceBundle,
        };
      } catch (error) {
        graphError = recordRuntimeIssue(nextState, {
          error,
          source: "graph-rag",
          severity: "warning",
          title: "Graph evidence unavailable",
          fallbackDetail: "graph retrieval failed",
          recovery:
            "Check the parser Graph RAG service and Neo4j container, then retry for citations.",
        });
      }
    }
  }

  nextState.decisionQuality = buildDecisionQuality(nextState);
  nextState.dashboard = buildInvestmentDashboard(nextState);
  nextState.lastUpdatedAt = new Date().toISOString();

  const responseText = composeAssistantResponse({
    userMessage,
    state: nextState,
    graphResult,
    graphError,
    filingReadError,
  });

  return {
    nextState,
    responseText,
  };
}
