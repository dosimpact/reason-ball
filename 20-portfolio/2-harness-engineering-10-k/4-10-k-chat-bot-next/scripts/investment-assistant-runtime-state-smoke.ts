import { buildInvestmentDashboard } from "@/lib/investment-assistant/dashboard";
import { buildDecisionQuality } from "@/lib/investment-assistant/decision-quality";
import { buildInvestmentDataReadiness } from "@/lib/investment-assistant/readiness";
import {
  appendRuntimeIssue,
  createRuntimeIssue,
  normalizeRuntimeState,
} from "@/lib/investment-assistant/runtime";
import {
  emptyInvestmentAssistantState,
  type InvestmentAssistantState,
  normalizeInvestmentA2UISurface,
} from "@/lib/investment-assistant/types";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const collectorUpdatedAt = new Date().toISOString();
const staleCollectorUpdatedAt = "2026-01-01T00:00:00.000Z";

const state: InvestmentAssistantState = {
  ...emptyInvestmentAssistantState,
  companyQuery: "AAPL",
  selectedFiling: {
    accessionNo: "0000320193-25-000079",
    companyName: "Apple Inc.",
    ticker: "AAPL",
    cik: "0000320193",
    formType: "10-K",
    filingDate: "2025-10-31",
    reportDate: "2025-09-27",
    filingUrl:
      "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm",
    provenance: {
      dataSource: "collector-database",
      documentSource: "downloaded-local-file",
      collectorUpdatedAt,
      parserStatus: "parsed",
      isDownloaded: true,
      hasLocalFile: true,
      freshnessStatus: "current",
      freshnessDetail: "Collector row was refreshed today.",
      refreshHint: null,
    },
  },
  brief: {
    stance: "mixed",
    conclusion:
      "Apple requires balanced follow-up because operating strength and risk exposure both need verification.",
    bull: ["Durable installed base and services ecosystem support resilience."],
    bear: ["Regulatory and supply chain risks could pressure margins."],
    unknowns: [
      "Current segment margin sensitivity is not proven by this smoke fixture.",
    ],
    nextChecks: [
      "Verify Item 8 revenue and margin trends before relying on the thesis.",
    ],
    evidence: [{ itemCode: "1A", rationale: "Risk factor evidence present." }],
  },
  runtime: normalizeRuntimeState(null),
};

appendRuntimeIssue(
  state,
  createRuntimeIssue({
    source: "parser-runtime",
    title: "Parser runtime unavailable",
    detail: "connect ECONNREFUSED 127.0.0.1:3406",
    recovery:
      "Check the parser service on port 3406, then retry the same prompt.",
  })
);

state.decisionQuality = buildDecisionQuality(state);
state.dashboard = buildInvestmentDashboard(state);
const dataReadiness = buildInvestmentDataReadiness(state);

invariant(
  state.runtime.status === "degraded",
  "runtime issue should mark workspace as degraded"
);
invariant(
  state.runtime.issues.length === 1,
  "runtime issue should be recorded"
);
invariant(state.dashboard, "runtime issues should produce a dashboard surface");
invariant(state.dashboard.root === "root", "dashboard root should be stable");
invariant(
  state.dashboard.components.some(
    (component) => component.id === "root" && component.component === "Card"
  ),
  "dashboard should include a root Card component"
);
invariant(
  state.decisionQuality?.status === "blocked",
  "runtime issue without graph or brief evidence should block decision quality"
);
invariant(
  dataReadiness.status === "blocked",
  "runtime issue should block data readiness"
);
invariant(
  dataReadiness.items.some((item) => item.label === "Parser graph"),
  "data readiness should expose parser graph readiness"
);

invariant(
  normalizeInvestmentA2UISurface(state.dashboard)?.root === "root",
  "valid dashboard surface should normalize"
);
invariant(
  normalizeInvestmentA2UISurface({ ...state.dashboard, root: "not-root" }) ===
    null,
  "dashboard with unsupported root should be rejected"
);
invariant(
  normalizeInvestmentA2UISurface({
    ...state.dashboard,
    components: [{ id: "root", component: "Grid" }],
  }) === null,
  "dashboard with unsupported component should be rejected"
);

const dashboardText = JSON.stringify(state.dashboard.components);

invariant(/Runtime Status/.test(dashboardText), "dashboard should show status");
invariant(
  /Workspace is degraded/.test(dashboardText),
  "dashboard should show degraded state"
);
invariant(
  /Parser runtime unavailable/.test(dashboardText),
  "dashboard should name parser runtime issue"
);
invariant(/port 3406/.test(dashboardText), "dashboard should include recovery");
invariant(
  /Source: Collector DB \/ Downloaded local file/.test(dashboardText),
  "dashboard should show filing provenance"
);
invariant(
  new RegExp(`Collector updated: ${collectorUpdatedAt.slice(0, 10)}`).test(
    dashboardText
  ),
  "dashboard should show collector freshness"
);
invariant(
  /Parser status: parsed/.test(dashboardText),
  "dashboard should show parser status"
);
invariant(
  /Freshness: current/.test(dashboardText),
  "dashboard should show freshness status"
);
invariant(
  /Decision Quality/.test(dashboardText),
  "dashboard should show decision quality"
);
invariant(
  /Data Readiness/.test(dashboardText),
  "dashboard should show data readiness"
);
invariant(
  /Filing catalog/.test(dashboardText),
  "dashboard should show filing catalog readiness"
);
invariant(
  /Local filing text/.test(dashboardText),
  "dashboard should show local filing text readiness"
);
invariant(
  /Parser graph/.test(dashboardText),
  "dashboard should show parser graph readiness"
);
invariant(
  /Runtime reliability/.test(dashboardText),
  "dashboard should show runtime reliability check"
);
invariant(
  /Brief evidence/.test(dashboardText),
  "dashboard should show brief evidence check"
);
invariant(/Bull Case/.test(dashboardText), "dashboard should show bull case");
invariant(/Bear Case/.test(dashboardText), "dashboard should show bear case");
invariant(/Unknowns/.test(dashboardText), "dashboard should show unknowns");
invariant(
  /Next Checks/.test(dashboardText),
  "dashboard should show next checks"
);

const readyState: InvestmentAssistantState = {
  ...state,
  graph: {
    intent: "risk",
    answer: "Grounded evidence for Apple Inc. is available.",
    evidenceBundle: [
      {
        citationLabel: "Item 1A",
        nodeType: "RiskFactor",
        text: "Regulatory risk can affect operations.",
        itemCode: "1A",
        filingId: "0000320193-25-000079",
        companyName: "Apple Inc.",
        score: 0.9,
        reason: "risk match",
      },
      {
        citationLabel: "Item 7",
        nodeType: "MDA",
        text: "Management discussion includes margin context.",
        itemCode: "7",
        filingId: "0000320193-25-000079",
        companyName: "Apple Inc.",
        score: 0.88,
        reason: "mda match",
      },
      {
        citationLabel: "Item 8",
        nodeType: "FinancialStatement",
        text: "Financial statements provide revenue context.",
        itemCode: "8",
        filingId: "0000320193-25-000079",
        companyName: "Apple Inc.",
        score: 0.86,
        reason: "financial match",
      },
    ],
  },
  runtime: normalizeRuntimeState(null),
  decisionQuality: null,
  dashboard: null,
};
readyState.decisionQuality = buildDecisionQuality(readyState);
readyState.dashboard = buildInvestmentDashboard(readyState);

const readyReadiness = buildInvestmentDataReadiness(readyState);
invariant(
  readyReadiness.status === "ready",
  "current local filing with graph evidence should be data ready"
);
invariant(
  /Data Readiness: Ready/.test(readyReadiness.summary),
  "ready data readiness should explain that data is ready"
);

const staleState: InvestmentAssistantState = {
  ...state,
  runtime: normalizeRuntimeState(null),
  selectedFiling: state.selectedFiling
    ? {
        ...state.selectedFiling,
        provenance: {
          ...state.selectedFiling.provenance,
          collectorUpdatedAt: staleCollectorUpdatedAt,
          freshnessStatus: "stale",
          freshnessDetail: "Collector row was last refreshed 162 days ago.",
          refreshHint:
            "Run company sync, filing metadata sync, download, and parser jobs before making a latest-filing decision.",
        },
      }
    : null,
};

staleState.decisionQuality = buildDecisionQuality(staleState);
staleState.dashboard = buildInvestmentDashboard(staleState);
const staleReadiness = buildInvestmentDataReadiness(staleState);

invariant(
  staleState.dashboard,
  "stale filing should produce a dashboard surface"
);
invariant(
  staleReadiness.status === "needs_action",
  "stale filing should require data readiness action"
);
invariant(
  staleReadiness.primaryAction?.includes("Run company sync") === true,
  "stale data readiness should preserve refresh guidance"
);

const staleDashboardText = JSON.stringify(staleState.dashboard.components);

invariant(
  /Freshness: refresh recommended/.test(staleDashboardText),
  "dashboard should show stale freshness label"
);
invariant(
  /Collector row was last refreshed 162 days ago/.test(staleDashboardText),
  "dashboard should show stale freshness detail"
);
invariant(
  /Run company sync, filing metadata sync, download, and parser jobs/.test(
    staleDashboardText
  ),
  "dashboard should show stale refresh guidance"
);
invariant(
  /Decision Quality/.test(staleDashboardText),
  "stale dashboard should show decision quality"
);
invariant(
  /Filing freshness/.test(staleDashboardText),
  "stale dashboard should show filing freshness check"
);

const unknownState: InvestmentAssistantState = {
  ...state,
  runtime: normalizeRuntimeState(null),
  selectedFiling: state.selectedFiling
    ? {
        ...state.selectedFiling,
        provenance: {
          ...state.selectedFiling.provenance,
          collectorUpdatedAt: null,
          freshnessStatus: "unknown",
          freshnessDetail: "Collector update timestamp is unavailable.",
          refreshHint:
            "Run the collector metadata and download jobs before relying on this filing as the latest available data.",
        },
      }
    : null,
};

unknownState.decisionQuality = buildDecisionQuality(unknownState);
unknownState.dashboard = buildInvestmentDashboard(unknownState);
const unknownReadiness = buildInvestmentDataReadiness(unknownState);

invariant(
  unknownState.dashboard,
  "unknown freshness filing should produce a dashboard surface"
);
invariant(
  unknownReadiness.status === "needs_action",
  "unknown freshness should require data readiness action"
);
invariant(
  unknownReadiness.primaryAction?.includes("collector metadata") === true,
  "unknown data readiness should preserve collector metadata guidance"
);

const unknownDashboardText = JSON.stringify(unknownState.dashboard.components);

invariant(
  /Collector updated: unknown/.test(unknownDashboardText),
  "dashboard should show missing collector timestamp"
);
invariant(
  /Freshness: unknown/.test(unknownDashboardText),
  "dashboard should show unknown freshness label"
);
invariant(
  /Collector update timestamp is unavailable/.test(unknownDashboardText),
  "dashboard should show unknown freshness detail"
);
invariant(
  /Run the collector metadata and download jobs/.test(unknownDashboardText),
  "dashboard should show unknown freshness refresh guidance"
);
invariant(
  /Decision Quality/.test(unknownDashboardText),
  "unknown dashboard should show decision quality"
);
invariant(
  /Filing freshness/.test(unknownDashboardText),
  "unknown dashboard should show filing freshness check"
);

console.log("investment assistant runtime state smoke OK");
