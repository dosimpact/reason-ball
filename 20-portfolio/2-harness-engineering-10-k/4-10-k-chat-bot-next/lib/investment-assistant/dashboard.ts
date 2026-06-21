import { buildDecisionQuality } from "@/lib/investment-assistant/decision-quality";
import { buildInvestmentDataReadiness } from "@/lib/investment-assistant/readiness";
import type {
  FilingProvenanceState,
  InvestmentA2UIColumnComponent,
  InvestmentA2UIComponent,
  InvestmentA2UIRootId,
  InvestmentA2UISurface,
  InvestmentA2UITextComponent,
  InvestmentAssistantState,
} from "@/lib/investment-assistant/types";

const SURFACE_ID = "investment-dashboard";
const ROOT_COMPONENT_ID: InvestmentA2UIRootId = "root";

function createTextComponent(
  id: string,
  text: string,
  variant: "h4" | "body" | "caption" = "body"
): InvestmentA2UITextComponent {
  return {
    id,
    component: "Text",
    text,
    variant,
  };
}

function createColumnComponent(
  id: string,
  children: string[]
): InvestmentA2UIColumnComponent {
  return {
    id,
    component: "Column",
    children,
  };
}

function createCardComponent(
  id: string,
  child: string
): InvestmentA2UIComponent {
  return {
    id,
    component: "Card",
    child,
  };
}

function createSectionCard({
  id,
  title,
  lines,
}: {
  id: string;
  title: string;
  lines: string[];
}) {
  const children: string[] = [];
  const components: InvestmentA2UIComponent[] = [];

  const titleId = `${id}-title`;
  children.push(titleId);
  components.push(createTextComponent(titleId, title, "h4"));

  for (let index = 0; index < lines.length; index += 1) {
    const lineId = `${id}-line-${index}`;
    children.push(lineId);
    components.push(
      createTextComponent(
        lineId,
        lines[index],
        index === 0 ? "body" : "caption"
      )
    );
  }

  const bodyId = `${id}-body`;
  components.push(createColumnComponent(bodyId, children));
  components.push(createCardComponent(id, bodyId));

  return components;
}

function truncate(input: string, maxLength: number) {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength - 3)}...`;
}

function formatFilingLabel(state: InvestmentAssistantState) {
  if (!state.selectedFiling) {
    return "No filing selected yet";
  }

  const { companyName, formType, filingDate, ticker } = state.selectedFiling;
  const tickerSuffix = ticker ? ` (${ticker})` : "";
  return `${companyName}${tickerSuffix} ${formType} ${filingDate ?? "date unknown"}`;
}

function formatDocumentSource(
  source: FilingProvenanceState["documentSource"] | undefined
) {
  if (source === "downloaded-local-file") {
    return "Downloaded local file";
  }

  if (source === "sec-archive-url") {
    return "SEC archive URL";
  }

  return "Metadata only";
}

function formatCollectorUpdatedAt(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function formatFreshnessStatus(
  status: FilingProvenanceState["freshnessStatus"] | undefined
) {
  if (status === "current") {
    return "current";
  }

  if (status === "stale") {
    return "refresh recommended";
  }

  return "unknown";
}

function formatProvenanceLines(provenance: FilingProvenanceState | undefined) {
  const lines = [
    `Source: Collector DB / ${formatDocumentSource(provenance?.documentSource)}`,
    `Collector updated: ${formatCollectorUpdatedAt(provenance?.collectorUpdatedAt)}`,
    `Parser status: ${provenance?.parserStatus ?? "not parsed"}`,
    `Freshness: ${formatFreshnessStatus(provenance?.freshnessStatus)}`,
    provenance?.freshnessDetail ?? "Collector freshness is unknown.",
  ];

  if (provenance?.refreshHint) {
    lines.push(`Refresh guidance: ${provenance.refreshHint}`);
  }

  return lines;
}

export function buildInvestmentDashboard(
  state: InvestmentAssistantState
): InvestmentA2UISurface | null {
  if (
    !state.selectedFiling &&
    !state.graph &&
    !state.brief &&
    state.runtime.issues.length === 0
  ) {
    return null;
  }

  const sections: string[] = [];
  const components: InvestmentA2UIComponent[] = [];
  const decisionQuality = state.decisionQuality ?? buildDecisionQuality(state);
  const dataReadiness = buildInvestmentDataReadiness(state);

  if (state.runtime.issues.length > 0) {
    components.push(
      ...createSectionCard({
        id: "runtime-status-card",
        title: "Runtime Status",
        lines: [
          "Workspace is degraded",
          ...state.runtime.issues
            .slice(0, 3)
            .map((issue) => `${issue.title}: ${truncate(issue.recovery, 180)}`),
        ],
      })
    );
    sections.push("runtime-status-card");
  }

  components.push(
    ...createSectionCard({
      id: "data-readiness-card",
      title: "Data Readiness",
      lines: [
        dataReadiness.summary,
        ...dataReadiness.items.map(
          (item) =>
            `${item.label}: ${item.status.replace("_", " ")} - ${truncate(item.detail, 140)}`
        ),
        ...(dataReadiness.primaryAction
          ? [`Primary action: ${truncate(dataReadiness.primaryAction, 180)}`]
          : []),
      ],
    })
  );
  sections.push("data-readiness-card");

  components.push(
    ...createSectionCard({
      id: "filing-summary-card",
      title: "Selected Filing",
      lines: [
        formatFilingLabel(state),
        ...(state.selectedFiling
          ? formatProvenanceLines(state.selectedFiling.provenance)
          : []),
        state.companyQuery
          ? `Company query: ${state.companyQuery}`
          : "Use a ticker, company name, or CIK to switch context.",
      ],
    })
  );
  sections.push("filing-summary-card");

  components.push(
    ...createSectionCard({
      id: "investment-stance-card",
      title: "Investment Frame",
      lines: state.brief
        ? [
            `Stance: ${state.brief.stance}`,
            truncate(state.brief.conclusion, 260),
          ]
        : [
            "Investment brief not built yet",
            "Ask for a brief, thesis, or investment decision framework.",
          ],
    })
  );
  sections.push("investment-stance-card");

  components.push(
    ...createSectionCard({
      id: "decision-quality-card",
      title: "Decision Quality",
      lines: decisionQuality
        ? [
            decisionQuality.summary,
            ...decisionQuality.checks.map(
              (check) =>
                `${check.label}: ${check.status} - ${truncate(check.detail, 140)}`
            ),
          ]
        : [
            "Decision Quality: not ready.",
            "Build an investment brief with filing and graph evidence first.",
          ],
    })
  );
  sections.push("decision-quality-card");

  components.push(
    ...createSectionCard({
      id: "bull-card",
      title: "Bull Case",
      lines: state.brief?.bull
        .slice(0, 3)
        .map((item) => `- ${truncate(item, 120)}`) ?? [
        "- Bull points will appear after a filing brief is built.",
      ],
    })
  );
  sections.push("bull-card");

  components.push(
    ...createSectionCard({
      id: "bear-card",
      title: "Bear Case",
      lines: state.brief?.bear
        .slice(0, 3)
        .map((item) => `- ${truncate(item, 120)}`) ?? [
        "- Bear points will appear after a filing brief is built.",
      ],
    })
  );
  sections.push("bear-card");

  components.push(
    ...createSectionCard({
      id: "unknowns-card",
      title: "Unknowns",
      lines: state.brief?.unknowns
        .slice(0, 3)
        .map((item) => `- ${truncate(item, 120)}`) ?? [
        "- Unknowns will appear after a filing brief is built.",
      ],
    })
  );
  sections.push("unknowns-card");

  components.push(
    ...createSectionCard({
      id: "checks-card",
      title: "Next Checks",
      lines: state.brief?.nextChecks
        .slice(0, 3)
        .map((item) => `- ${truncate(item, 120)}`) ?? [
        "- Additional checks will appear after analysis.",
      ],
    })
  );
  sections.push("checks-card");

  components.push(
    ...createSectionCard({
      id: "graph-evidence-card",
      title: "Graph Evidence",
      lines: state.graph?.evidenceBundle.slice(0, 4).map((evidence) => {
        const itemLabel = evidence.itemCode
          ? `Item ${evidence.itemCode}`
          : "Item ?";
        return `${itemLabel}: ${truncate(evidence.text.replaceAll(/\s+/g, " "), 120)}`;
      }) ?? ["No graph-grounded evidence available yet."],
    })
  );
  sections.push("graph-evidence-card");

  const bodyId = "investment-dashboard-body";
  components.push(createColumnComponent(bodyId, sections));
  components.push(createCardComponent(ROOT_COMPONENT_ID, bodyId));

  return {
    surfaceId: SURFACE_ID,
    root: ROOT_COMPONENT_ID,
    components,
    data: {},
  };
}

export function buildA2UIActivityContent(surface: InvestmentA2UISurface) {
  return {
    operations: [
      {
        createSurface: {
          surfaceId: surface.surfaceId,
          catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
          theme: {},
          sendDataModel: false,
        },
      },
      {
        updateComponents: {
          surfaceId: surface.surfaceId,
          components: surface.components,
        },
      },
      ...(Object.keys(surface.data).length > 0
        ? [
            {
              updateDataModel: {
                surfaceId: surface.surfaceId,
                path: "/",
                value: surface.data,
              },
            },
          ]
        : []),
    ],
  };
}
