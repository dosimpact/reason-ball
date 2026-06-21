import type {
  InvestmentAssistantRuntimeIssue,
  InvestmentAssistantRuntimeIssueSource,
  InvestmentAssistantState,
} from "@/lib/investment-assistant/types";

export type InvestmentDataReadinessStatus =
  | "ready"
  | "needs_action"
  | "blocked"
  | "unknown";

export type InvestmentDataReadinessItemId =
  | "filing-catalog"
  | "local-filing-text"
  | "parser-graph"
  | "filing-freshness"
  | "runtime";

export type InvestmentDataReadinessItem = {
  id: InvestmentDataReadinessItemId;
  label: string;
  status: InvestmentDataReadinessStatus;
  detail: string;
  action: string | null;
};

export type InvestmentDataReadiness = {
  status: InvestmentDataReadinessStatus;
  label: string;
  summary: string;
  primaryAction: string | null;
  items: InvestmentDataReadinessItem[];
};

function getRuntimeIssue(
  state: Pick<InvestmentAssistantState, "runtime">,
  source: InvestmentAssistantRuntimeIssueSource
) {
  return state.runtime.issues.find((issue) => issue.source === source) ?? null;
}

function statusLabel(status: InvestmentDataReadinessStatus) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "needs_action") {
    return "Action needed";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Unknown";
}

function issueToItemStatus(
  issue: InvestmentAssistantRuntimeIssue | null
): InvestmentDataReadinessStatus | null {
  if (!issue) {
    return null;
  }

  return issue.severity === "error" ? "blocked" : "needs_action";
}

function formatIssueRecovery(issue: InvestmentAssistantRuntimeIssue) {
  return `${issue.title}: ${issue.recovery}`;
}

function isParsedStatus(parserStatus: string | null | undefined) {
  if (!parserStatus) {
    return false;
  }

  const normalized = parserStatus.trim().toLowerCase();
  if (
    normalized.includes("not parsed") ||
    normalized.includes("unparsed") ||
    normalized.includes("pending") ||
    normalized.includes("queued")
  ) {
    return false;
  }

  return (
    normalized === "parsed" ||
    normalized === "complete" ||
    normalized === "completed" ||
    normalized.includes("parsed") ||
    normalized.includes("indexed")
  );
}

function isFailedParserStatus(parserStatus: string | null | undefined) {
  if (!parserStatus) {
    return false;
  }

  const normalized = parserStatus.trim().toLowerCase();
  return normalized.includes("fail") || normalized.includes("error");
}

function buildFilingCatalogItem(
  state: InvestmentAssistantState
): InvestmentDataReadinessItem {
  const issue = getRuntimeIssue(state, "filing-catalog");
  const issueStatus = issueToItemStatus(issue);

  if (issue && issueStatus) {
    return {
      id: "filing-catalog",
      label: "Filing catalog",
      status: issueStatus,
      detail: "The assistant could not reliably load the filing ladder.",
      action: formatIssueRecovery(issue),
    };
  }

  if (state.filings.length > 0) {
    return {
      id: "filing-catalog",
      label: "Filing catalog",
      status: "ready",
      detail: `${state.filings.length} recent filing${state.filings.length === 1 ? "" : "s"} are available for this company context.`,
      action: null,
    };
  }

  if (state.selectedFiling) {
    return {
      id: "filing-catalog",
      label: "Filing catalog",
      status: "ready",
      detail:
        "A selected filing is available even though the full ladder is not populated.",
      action: null,
    };
  }

  if (state.companyQuery) {
    return {
      id: "filing-catalog",
      label: "Filing catalog",
      status: "needs_action",
      detail: `No recent filing ladder is loaded for ${state.companyQuery}.`,
      action:
        "Run company sync and filing metadata sync, then ask for the company again.",
    };
  }

  return {
    id: "filing-catalog",
    label: "Filing catalog",
    status: "unknown",
    detail: "No company, ticker, or CIK has been selected yet.",
    action: "Ask for a company filing to load the filing catalog.",
  };
}

function buildLocalFilingTextItem(
  state: InvestmentAssistantState
): InvestmentDataReadinessItem {
  const issue = getRuntimeIssue(state, "filing-reader");
  const issueStatus = issueToItemStatus(issue);

  if (issue && issueStatus) {
    return {
      id: "local-filing-text",
      label: "Local filing text",
      status: issueStatus,
      detail: "The filing text reader reported a dependency problem.",
      action: formatIssueRecovery(issue),
    };
  }

  const provenance = state.selectedFiling?.provenance;
  if (!state.selectedFiling || !provenance) {
    return {
      id: "local-filing-text",
      label: "Local filing text",
      status: "unknown",
      detail: "No selected filing is available for text extraction.",
      action: "Select a filing before building a brief.",
    };
  }

  if (
    provenance.documentSource === "downloaded-local-file" &&
    provenance.isDownloaded &&
    provenance.hasLocalFile
  ) {
    return {
      id: "local-filing-text",
      label: "Local filing text",
      status: "ready",
      detail:
        "The selected filing is backed by a downloaded local filing file.",
      action: null,
    };
  }

  if (provenance.documentSource === "sec-archive-url") {
    return {
      id: "local-filing-text",
      label: "Local filing text",
      status: "needs_action",
      detail:
        "The selected filing is available as an SEC archive URL, but local text is not confirmed.",
      action:
        "Run the filing download job before relying on full-text extraction.",
    };
  }

  return {
    id: "local-filing-text",
    label: "Local filing text",
    status: "needs_action",
    detail: "Only filing metadata is available for the selected report.",
    action:
      "Run filing metadata sync and filing download jobs before building a full brief.",
  };
}

function buildParserGraphItem(
  state: InvestmentAssistantState
): InvestmentDataReadinessItem {
  const graphIssue = getRuntimeIssue(state, "graph-rag");
  const parserIssue = getRuntimeIssue(state, "parser-runtime");
  const issue = graphIssue ?? parserIssue;
  const issueStatus = issueToItemStatus(issue);

  if (issue && issueStatus) {
    return {
      id: "parser-graph",
      label: "Parser graph",
      status: issueStatus,
      detail: "Graph-backed evidence is not fully available for this turn.",
      action: formatIssueRecovery(issue),
    };
  }

  const evidenceCount = state.graph?.evidenceBundle.length ?? 0;
  if (evidenceCount >= 3) {
    return {
      id: "parser-graph",
      label: "Parser graph",
      status: "ready",
      detail: `${evidenceCount} graph evidence snippets are available for citation-level validation.`,
      action: null,
    };
  }

  if (evidenceCount > 0) {
    return {
      id: "parser-graph",
      label: "Parser graph",
      status: "needs_action",
      detail: `Only ${evidenceCount} graph evidence snippet${evidenceCount === 1 ? "" : "s"} is available.`,
      action:
        "Ask a graph-grounded follow-up or rerun parser graph retrieval for this filing.",
    };
  }

  const parserStatus = state.selectedFiling?.provenance.parserStatus ?? null;
  if (!state.selectedFiling) {
    return {
      id: "parser-graph",
      label: "Parser graph",
      status: "unknown",
      detail: "No filing is selected for parser graph retrieval.",
      action: "Select a filing before querying Graph RAG evidence.",
    };
  }

  if (isFailedParserStatus(parserStatus)) {
    return {
      id: "parser-graph",
      label: "Parser graph",
      status: "blocked",
      detail: `Parser status is ${parserStatus}.`,
      action:
        "Inspect parser job logs, rerun the parser job, then retry Graph RAG retrieval.",
    };
  }

  if (isParsedStatus(parserStatus)) {
    return {
      id: "parser-graph",
      label: "Parser graph",
      status: "needs_action",
      detail:
        "The filing is parsed, but no graph evidence has been attached to the workspace yet.",
      action:
        "Ask for graph-grounded evidence or rerun retrieval before relying on citations.",
    };
  }

  return {
    id: "parser-graph",
    label: "Parser graph",
    status: "needs_action",
    detail: `Parser status is ${parserStatus ?? "not parsed"}.`,
    action:
      "Run the parser job for this filing, then ask for graph-grounded evidence.",
  };
}

function buildFilingFreshnessItem(
  state: InvestmentAssistantState
): InvestmentDataReadinessItem {
  const provenance = state.selectedFiling?.provenance;

  if (!state.selectedFiling || !provenance) {
    return {
      id: "filing-freshness",
      label: "Filing freshness",
      status: "unknown",
      detail: "No selected filing freshness metadata is available.",
      action: "Load a company filing to check collector freshness.",
    };
  }

  if (provenance.freshnessStatus === "current") {
    return {
      id: "filing-freshness",
      label: "Filing freshness",
      status: "ready",
      detail: provenance.freshnessDetail || "Collector metadata is current.",
      action: null,
    };
  }

  return {
    id: "filing-freshness",
    label: "Filing freshness",
    status: "needs_action",
    detail:
      provenance.freshnessDetail ||
      "Collector freshness is not current for the selected filing.",
    action:
      provenance.refreshHint ??
      "Run company sync, filing metadata sync, download, and parser jobs before making a latest-filing decision.",
  };
}

function buildRuntimeItem(
  state: InvestmentAssistantState
): InvestmentDataReadinessItem {
  const errors = state.runtime.issues.filter(
    (issue) => issue.severity === "error"
  );
  if (errors.length > 0) {
    return {
      id: "runtime",
      label: "Runtime dependencies",
      status: "blocked",
      detail: `${errors.length} runtime dependency error${errors.length === 1 ? "" : "s"} occurred during the latest turn.`,
      action: errors.map(formatIssueRecovery).join(" "),
    };
  }

  if (state.runtime.issues.length > 0) {
    return {
      id: "runtime",
      label: "Runtime dependencies",
      status: "needs_action",
      detail: `${state.runtime.issues.length} runtime warning${state.runtime.issues.length === 1 ? "" : "s"} occurred during the latest turn.`,
      action: state.runtime.issues.map(formatIssueRecovery).join(" "),
    };
  }

  return {
    id: "runtime",
    label: "Runtime dependencies",
    status: "ready",
    detail: "No degraded backend dependency was reported during this turn.",
    action: null,
  };
}

function deriveOverallStatus(
  items: InvestmentDataReadinessItem[]
): InvestmentDataReadinessStatus {
  if (items.some((item) => item.status === "blocked")) {
    return "blocked";
  }

  if (items.some((item) => item.status === "needs_action")) {
    return "needs_action";
  }

  const nonRuntimeItems = items.filter((item) => item.id !== "runtime");
  if (nonRuntimeItems.every((item) => item.status === "unknown")) {
    return "unknown";
  }

  if (items.some((item) => item.status === "unknown")) {
    return "needs_action";
  }

  return "ready";
}

function buildSummary(
  status: InvestmentDataReadinessStatus,
  primaryItem: InvestmentDataReadinessItem | null
) {
  if (status === "ready") {
    return "Data Readiness: Ready. Filing catalog, local text, parser graph, freshness, and runtime dependencies are ready for analysis.";
  }

  if (status === "blocked") {
    return `Data Readiness: Blocked. Resolve ${primaryItem?.label ?? "the failing dependency"} before relying on this workspace.`;
  }

  if (status === "needs_action") {
    return `Data Readiness: Action needed. Resolve ${primaryItem?.label ?? "the incomplete data step"} before treating the analysis as production-ready.`;
  }

  return "Data Readiness: Unknown. Select a company filing to evaluate catalog, text, graph, freshness, and runtime readiness.";
}

const primaryItemPriority: InvestmentDataReadinessItemId[] = [
  "runtime",
  "filing-freshness",
  "filing-catalog",
  "local-filing-text",
  "parser-graph",
];

function findPrimaryItem(
  items: InvestmentDataReadinessItem[],
  status: InvestmentDataReadinessStatus
) {
  for (const itemId of primaryItemPriority) {
    const item = items.find(
      (candidate) => candidate.id === itemId && candidate.status === status
    );
    if (item) {
      return item;
    }
  }

  return null;
}

export function buildInvestmentDataReadiness(
  state: InvestmentAssistantState
): InvestmentDataReadiness {
  const items = [
    buildFilingCatalogItem(state),
    buildLocalFilingTextItem(state),
    buildParserGraphItem(state),
    buildFilingFreshnessItem(state),
    buildRuntimeItem(state),
  ];
  const status = deriveOverallStatus(items);
  const primaryItem =
    findPrimaryItem(items, "blocked") ??
    findPrimaryItem(items, "needs_action") ??
    findPrimaryItem(items, "unknown");

  return {
    status,
    label: statusLabel(status),
    summary: buildSummary(status, primaryItem),
    primaryAction: primaryItem?.action ?? null,
    items,
  };
}
