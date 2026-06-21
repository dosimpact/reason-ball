import type { InvestmentDecisionBrief, ReaderTocItem } from "@/lib/sec/types";

export type FilingListItem = {
  accessionNo: string;
  formType: string;
  filingDate: string | null;
  companyName: string;
  ticker: string | null;
  cik: string;
  filingUrl: string;
  provenance: FilingProvenanceState;
};

export type FilingSelectionState = {
  accessionNo: string;
  companyName: string;
  ticker: string | null;
  cik: string;
  formType: string;
  filingDate: string | null;
  reportDate: string | null;
  filingUrl: string;
  provenance: FilingProvenanceState;
};

export type FilingProvenanceState = {
  dataSource: "collector-database";
  documentSource: "downloaded-local-file" | "sec-archive-url" | "metadata-only";
  collectorUpdatedAt: string | null;
  parserStatus: string | null;
  isDownloaded: boolean;
  hasLocalFile: boolean;
  freshnessStatus: "current" | "stale" | "unknown";
  freshnessDetail: string;
  refreshHint: string | null;
};

export type ReaderState = {
  toc: ReaderTocItem[];
  keyItems: ReaderTocItem[];
  preview: string;
};

export type GraphEvidence = {
  citationLabel: string;
  nodeType: string;
  text: string;
  itemCode: string | null;
  filingId: string | null;
  companyName: string | null;
  score: number;
  reason: string;
};

export type GraphRagState = {
  intent: string | null;
  answer: string | null;
  evidenceBundle: GraphEvidence[];
};

export type DecisionQualityCheckStatus = "pass" | "warn" | "fail";

export type DecisionQualityCheck = {
  label: string;
  status: DecisionQualityCheckStatus;
  detail: string;
};

export type DecisionQualityState = {
  status: "ready" | "review-needed" | "blocked";
  summary: string;
  checks: DecisionQualityCheck[];
};

export type InvestmentA2UIRootId = "root";

export type InvestmentA2UITextComponent = {
  id: string;
  component: "Text";
  text: string;
  variant: "h4" | "body" | "caption";
};

export type InvestmentA2UIColumnComponent = {
  id: string;
  component: "Column";
  children: string[];
};

export type InvestmentA2UICardComponent = {
  id: string;
  component: "Card";
  child: string;
};

export type InvestmentA2UIComponent =
  | InvestmentA2UITextComponent
  | InvestmentA2UIColumnComponent
  | InvestmentA2UICardComponent;

export type InvestmentA2UISurface = {
  surfaceId: string;
  root: InvestmentA2UIRootId;
  components: InvestmentA2UIComponent[];
  data: Record<string, unknown>;
};

export type InvestmentAssistantRuntimeIssueSource =
  | "filing-catalog"
  | "filing-reader"
  | "graph-rag"
  | "parser-runtime";

export type InvestmentAssistantRuntimeIssue = {
  source: InvestmentAssistantRuntimeIssueSource;
  severity: "warning" | "error";
  title: string;
  detail: string;
  recovery: string;
  occurredAt: string;
};

export type InvestmentAssistantRuntimeState = {
  status: "ready" | "degraded";
  issues: InvestmentAssistantRuntimeIssue[];
};

export type InvestmentAssistantState = {
  companyQuery: string | null;
  filings: FilingListItem[];
  selectedFiling: FilingSelectionState | null;
  reader: ReaderState | null;
  graph: GraphRagState | null;
  brief: InvestmentDecisionBrief | null;
  decisionQuality: DecisionQualityState | null;
  dashboard: InvestmentA2UISurface | null;
  runtime: InvestmentAssistantRuntimeState;
  lastUserIntent: string | null;
  lastUpdatedAt: string | null;
};

export const emptyInvestmentAssistantState: InvestmentAssistantState = {
  companyQuery: null,
  filings: [],
  selectedFiling: null,
  reader: null,
  graph: null,
  brief: null,
  decisionQuality: null,
  dashboard: null,
  runtime: {
    status: "ready",
    issues: [],
  },
  lastUserIntent: null,
  lastUpdatedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isInvestmentA2UIComponent(
  value: unknown
): value is InvestmentA2UIComponent {
  if (!isRecord(value) || typeof value.id !== "string") {
    return false;
  }

  if (value.component === "Text") {
    return (
      typeof value.text === "string" &&
      (value.variant === "h4" ||
        value.variant === "body" ||
        value.variant === "caption")
    );
  }

  if (value.component === "Column") {
    return isStringArray(value.children);
  }

  if (value.component === "Card") {
    return typeof value.child === "string";
  }

  return false;
}

export function normalizeInvestmentA2UISurface(
  value: unknown
): InvestmentA2UISurface | null {
  if (
    !isRecord(value) ||
    typeof value.surfaceId !== "string" ||
    value.root !== "root" ||
    !Array.isArray(value.components) ||
    !value.components.every(isInvestmentA2UIComponent) ||
    !isRecord(value.data)
  ) {
    return null;
  }

  return {
    surfaceId: value.surfaceId,
    root: value.root,
    components: value.components,
    data: value.data,
  };
}
