import type {
  DecisionQualityCheck,
  DecisionQualityState,
  InvestmentAssistantState,
} from "@/lib/investment-assistant/types";

function createCheck(
  label: string,
  status: DecisionQualityCheck["status"],
  detail: string
): DecisionQualityCheck {
  return { label, status, detail };
}

function formatStatusLabel(status: DecisionQualityState["status"]) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "review-needed") {
    return "Review needed";
  }

  return "Blocked";
}

export function buildDecisionQuality(
  state: Pick<
    InvestmentAssistantState,
    "selectedFiling" | "graph" | "brief" | "runtime"
  >
): DecisionQualityState | null {
  if (!state.selectedFiling && !state.graph && !state.brief) {
    return null;
  }

  const provenance = state.selectedFiling?.provenance;
  const graphEvidenceCount = state.graph?.evidenceBundle.length ?? 0;
  const briefEvidenceCount = state.brief?.evidence.length ?? 0;
  const runtimeIssues = state.runtime.issues;
  const checks: DecisionQualityCheck[] = [];

  checks.push(
    state.selectedFiling
      ? createCheck(
          "Filing selected",
          "pass",
          `${state.selectedFiling.companyName} ${state.selectedFiling.formType} is active.`
        )
      : createCheck(
          "Filing selected",
          "fail",
          "No filing is selected, so the assistant cannot ground a decision."
        )
  );

  if (provenance?.freshnessStatus === "current") {
    checks.push(
      createCheck(
        "Filing freshness",
        "pass",
        provenance.freshnessDetail || "Collector metadata is current."
      )
    );
  } else if (provenance?.freshnessStatus === "stale") {
    checks.push(
      createCheck(
        "Filing freshness",
        "warn",
        provenance.refreshHint ?? provenance.freshnessDetail
      )
    );
  } else {
    checks.push(
      createCheck(
        "Filing freshness",
        "warn",
        provenance?.refreshHint ??
          "Collector update timestamp is unavailable; refresh metadata before relying on latest-filing status."
      )
    );
  }

  if (provenance?.hasLocalFile && provenance.isDownloaded) {
    checks.push(
      createCheck(
        "Filing text",
        "pass",
        "The brief can read the downloaded local filing text."
      )
    );
  } else {
    checks.push(
      createCheck(
        "Filing text",
        "warn",
        "The selected filing is not backed by a downloaded local file."
      )
    );
  }

  if (briefEvidenceCount >= 3) {
    checks.push(
      createCheck(
        "Brief evidence",
        "pass",
        `${briefEvidenceCount} filing evidence items support the bull/bear frame.`
      )
    );
  } else if (briefEvidenceCount > 0) {
    checks.push(
      createCheck(
        "Brief evidence",
        "warn",
        `Only ${briefEvidenceCount} filing evidence item${briefEvidenceCount === 1 ? "" : "s"} support the brief.`
      )
    );
  } else {
    checks.push(
      createCheck(
        "Brief evidence",
        "fail",
        "No investment brief evidence has been generated yet."
      )
    );
  }

  if (graphEvidenceCount >= 3) {
    checks.push(
      createCheck(
        "Graph evidence",
        "pass",
        `${graphEvidenceCount} Neo4j Graph RAG evidence snippets are available.`
      )
    );
  } else if (graphEvidenceCount > 0) {
    checks.push(
      createCheck(
        "Graph evidence",
        "warn",
        `Only ${graphEvidenceCount} Graph RAG evidence snippet${graphEvidenceCount === 1 ? "" : "s"} is available.`
      )
    );
  } else {
    checks.push(
      createCheck(
        "Graph evidence",
        "fail",
        "No graph-grounded evidence is available for citation-level validation."
      )
    );
  }

  if (runtimeIssues.length === 0) {
    checks.push(
      createCheck(
        "Runtime reliability",
        "pass",
        "No degraded dependency was reported during this turn."
      )
    );
  } else if (runtimeIssues.some((issue) => issue.severity === "error")) {
    checks.push(
      createCheck(
        "Runtime reliability",
        "fail",
        runtimeIssues.map((issue) => issue.recovery).join(" ")
      )
    );
  } else {
    checks.push(
      createCheck(
        "Runtime reliability",
        "warn",
        runtimeIssues.map((issue) => issue.recovery).join(" ")
      )
    );
  }

  const hasFailure = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warn");
  const status = hasFailure
    ? "blocked"
    : hasWarning
      ? "review-needed"
      : "ready";
  const summary =
    status === "ready"
      ? "Evidence, freshness, filing text, and runtime checks are ready for investment review."
      : status === "review-needed"
        ? "Use the brief, but resolve freshness or evidence warnings before relying on it as a final decision."
        : "Do not rely on this brief as a final decision until failed evidence or runtime checks are resolved.";

  return {
    status,
    summary: `Decision Quality: ${formatStatusLabel(status)}. ${summary}`,
    checks,
  };
}
