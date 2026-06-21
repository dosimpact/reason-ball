import type {
  InvestmentAssistantRuntimeIssue,
  InvestmentAssistantRuntimeIssueSource,
  InvestmentAssistantRuntimeState,
  InvestmentAssistantState,
} from "@/lib/investment-assistant/types";

type RuntimeIssueInput = {
  source: InvestmentAssistantRuntimeIssueSource;
  severity?: InvestmentAssistantRuntimeIssue["severity"];
  title: string;
  detail: string;
  recovery: string;
};

const MAX_RUNTIME_ISSUES = 6;

function normalizeDetail(detail: string) {
  return detail.replace(/\s+/g, " ").trim().slice(0, 280);
}

export function createRuntimeIssue({
  source,
  severity = "error",
  title,
  detail,
  recovery,
}: RuntimeIssueInput): InvestmentAssistantRuntimeIssue {
  return {
    source,
    severity,
    title,
    detail: normalizeDetail(detail || "No additional detail was provided."),
    recovery,
    occurredAt: new Date().toISOString(),
  };
}

export function normalizeRuntimeState(
  runtime: Partial<InvestmentAssistantRuntimeState> | null | undefined
): InvestmentAssistantRuntimeState {
  const issues = Array.isArray(runtime?.issues)
    ? runtime.issues.filter(
        (issue): issue is InvestmentAssistantRuntimeIssue =>
          Boolean(issue) &&
          typeof issue.source === "string" &&
          typeof issue.title === "string" &&
          typeof issue.detail === "string" &&
          typeof issue.recovery === "string" &&
          typeof issue.occurredAt === "string"
      )
    : [];

  return {
    status: issues.length > 0 ? "degraded" : "ready",
    issues: issues.slice(0, MAX_RUNTIME_ISSUES),
  };
}

export function clearRuntimeIssues(state: InvestmentAssistantState) {
  state.runtime = {
    status: "ready",
    issues: [],
  };
}

export function appendRuntimeIssue(
  state: InvestmentAssistantState,
  issue: InvestmentAssistantRuntimeIssue
) {
  const current = normalizeRuntimeState(state.runtime);
  const issues = [
    issue,
    ...current.issues.filter((candidate) => candidate.source !== issue.source),
  ].slice(0, MAX_RUNTIME_ISSUES);

  state.runtime = {
    status: issues.length > 0 ? "degraded" : "ready",
    issues,
  };
}
