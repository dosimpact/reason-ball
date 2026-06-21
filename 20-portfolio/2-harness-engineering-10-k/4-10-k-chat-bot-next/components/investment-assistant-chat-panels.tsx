"use client";

import { InvestmentA2UIViewer } from "@/components/a2ui-investment-viewer";
import {
  FilingProvenanceBadges,
  formatCollectorUpdatedAt,
  formatDocumentSourceLabel,
  formatParserStatus,
} from "@/components/investment-assistant-provenance";
import { InvestmentDataReadinessCard } from "@/components/investment-data-readiness-card";
import { InvestmentDecisionQualityCard } from "@/components/investment-decision-quality-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { dedupeGraphEvidence } from "@/lib/investment-assistant/evidence";
import { buildInvestmentDataReadiness } from "@/lib/investment-assistant/readiness";
import { normalizeRuntimeState } from "@/lib/investment-assistant/runtime";
import {
  emptyInvestmentAssistantState,
  type InvestmentAssistantState,
  normalizeInvestmentA2UISurface,
} from "@/lib/investment-assistant/types";

type InvestmentAssistantChatPanelsMessageProps = {
  message: unknown;
  position: "before" | "after";
  runId: string;
  messageIndex: number;
  messageIndexInRun: number;
  numberOfMessagesInRun: number;
  agentId: string;
  stateSnapshot: unknown;
};

function normalizeInvestmentAssistantState(
  stateSnapshot: unknown
): InvestmentAssistantState {
  const state = (stateSnapshot ?? {}) as Partial<InvestmentAssistantState>;

  return {
    ...emptyInvestmentAssistantState,
    ...state,
    filings: Array.isArray(state.filings) ? state.filings : [],
    selectedFiling: state.selectedFiling ?? null,
    reader: state.reader ?? null,
    graph: state.graph ?? null,
    brief: state.brief ?? null,
    decisionQuality: state.decisionQuality ?? null,
    dashboard: normalizeInvestmentA2UISurface(state.dashboard),
    runtime: normalizeRuntimeState(state.runtime),
    lastUserIntent: state.lastUserIntent ?? null,
    lastUpdatedAt: state.lastUpdatedAt ?? null,
  };
}

export function InvestmentAssistantChatPanelsMessage({
  position,
  messageIndexInRun,
  numberOfMessagesInRun,
  stateSnapshot,
}: InvestmentAssistantChatPanelsMessageProps) {
  if (position !== "after") {
    return null;
  }

  if (messageIndexInRun !== numberOfMessagesInRun - 1) {
    return null;
  }

  const state = normalizeInvestmentAssistantState(stateSnapshot);
  const keyItems = Array.isArray(state.reader?.keyItems)
    ? state.reader.keyItems
    : [];
  const graphEvidence = dedupeGraphEvidence(state.graph?.evidenceBundle);
  const dashboardComponents = Array.isArray(state.dashboard?.components)
    ? state.dashboard.components
    : [];
  const dataReadiness = buildInvestmentDataReadiness(state);
  const stanceVariant =
    state.brief?.stance === "positive"
      ? "default"
      : state.brief?.stance === "mixed"
        ? "secondary"
        : "outline";

  const hasRenderableContent =
    Boolean(state.selectedFiling) ||
    graphEvidence.length > 0 ||
    Boolean(state.graph?.answer) ||
    Boolean(state.dashboard) ||
    state.runtime.issues.length > 0;

  if (!hasRenderableContent) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="px-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Workspace Snapshot
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The assistant is exposing its current filing selection, graph-grounded
          evidence, and decision workspace directly in chat.
        </p>
      </div>

      {state.runtime.issues.length > 0 ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.25)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Runtime Status</CardTitle>
              <Badge variant="destructive">Degraded</Badge>
            </div>
            <CardDescription>
              Some backend dependency failed during this turn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {state.runtime.issues.map((issue) => (
              <div
                className="rounded-xl border border-destructive/20 bg-background px-3 py-3"
                key={`${issue.source}-${issue.occurredAt}`}
              >
                <div className="font-medium text-foreground">{issue.title}</div>
                <p className="mt-1 text-muted-foreground">{issue.recovery}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <InvestmentDataReadinessCard compact readiness={dataReadiness} />

      <Card className="border-border bg-card shadow-[0_18px_40px_-30px_rgba(15,23,42,0.25)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selected Filing</CardTitle>
          <CardDescription>
            The filing the assistant is currently grounding on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {state.selectedFiling ? (
            <>
              <div className="space-y-1">
                <div className="font-medium text-foreground">
                  {state.selectedFiling.companyName}{" "}
                  {state.selectedFiling.formType}
                </div>
                <div className="text-muted-foreground">
                  {state.selectedFiling.ticker ?? state.selectedFiling.cik} ·{" "}
                  {state.selectedFiling.filingDate ?? "date unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Collector updated:{" "}
                  {formatCollectorUpdatedAt(
                    state.selectedFiling.provenance?.collectorUpdatedAt
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <FilingProvenanceBadges
                  provenance={state.selectedFiling.provenance}
                />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>{state.selectedFiling.provenance.freshnessDetail}</p>
                  {state.selectedFiling.provenance.refreshHint ? (
                    <p>{state.selectedFiling.provenance.refreshHint}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{keyItems.length} key items</Badge>
                  {state.brief ? (
                    <Badge variant={stanceVariant}>{state.brief.stance}</Badge>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              No filing selected yet for this turn.
            </p>
          )}

          {state.filings.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recent Filings
              </div>
              {state.filings.slice(0, 3).map((filing) => (
                <div
                  className="rounded-xl border border-border bg-muted/80 px-3 py-2"
                  key={filing.accessionNo}
                >
                  <div className="font-medium text-foreground">
                    {filing.formType} · {filing.filingDate ?? "unknown"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {filing.accessionNo}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {formatDocumentSourceLabel(
                        filing.provenance?.documentSource
                      )}
                    </span>
                    <span>
                      Parser:{" "}
                      {formatParserStatus(filing.provenance?.parserStatus)}
                    </span>
                    <span>
                      Updated:{" "}
                      {formatCollectorUpdatedAt(
                        filing.provenance?.collectorUpdatedAt
                      )}
                    </span>
                    <span>
                      Freshness:{" "}
                      {filing.provenance?.freshnessStatus ?? "unknown"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <InvestmentDecisionQualityCard
        compact
        decisionQuality={state.decisionQuality}
      />

      <Card className="border-border bg-card shadow-[0_18px_40px_-30px_rgba(15,23,42,0.25)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Graph Evidence</CardTitle>
          <CardDescription>
            Grounded snippets coming from the Neo4j-backed Graph RAG layer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {state.graph?.answer ? (
            <div className="rounded-xl border border-border bg-muted px-3 py-3 text-foreground">
              {state.graph.answer}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No graph-grounded answer was produced for this turn.
            </p>
          )}

          {graphEvidence.slice(0, 4).map((evidence) => (
            <div
              className="rounded-xl border border-border bg-muted/40 px-3 py-3"
              key={`${evidence.filingId ?? "filing"}-${evidence.itemCode ?? "item"}-${evidence.citationLabel ?? "citation"}-${evidence.text.slice(0, 48)}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {evidence.citationLabel}
                </span>
                <span className="text-xs text-muted-foreground">
                  {evidence.nodeType}
                </span>
              </div>
              <p className="text-foreground/90">
                {evidence.text.slice(0, 220)}
                {evidence.text.length > 220 ? "..." : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-[0_18px_40px_-30px_rgba(15,23,42,0.25)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">A2UI Dashboard</CardTitle>
          <CardDescription>
            Structured decision workspace for bull, bear, unknowns, stance, and
            follow-up checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {state.dashboard ? (
            <InvestmentA2UIViewer
              className="max-h-[320px] overflow-auto rounded-2xl border border-border bg-muted/40 p-3"
              components={dashboardComponents}
              data={state.dashboard.data}
              root={state.dashboard.root}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/60 px-6 py-8 text-center text-sm text-muted-foreground">
              No dashboard was generated for this turn yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
