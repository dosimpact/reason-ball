"use client";

import {
  CopilotChat,
  CopilotKitProvider,
  type ReactCustomMessageRenderer,
  useAgent,
  useConfigureSuggestions,
} from "@copilotkit/react-core/v2";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { InvestmentA2UIViewer } from "@/components/a2ui-investment-viewer";
import { PlusIcon } from "@/components/icons";
import { InvestmentAssistantChatPanelsMessage } from "@/components/investment-assistant-chat-panels";
import {
  FilingProvenanceBadges,
  formatCollectorUpdatedAt,
  formatDocumentSourceLabel,
  formatParserStatus,
} from "@/components/investment-assistant-provenance";
import { InvestmentDataReadinessCard } from "@/components/investment-data-readiness-card";
import { InvestmentDecisionQualityCard } from "@/components/investment-decision-quality-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { dedupeGraphEvidence } from "@/lib/investment-assistant/evidence";
import { createInvestmentAssistantThreadPath } from "@/lib/investment-assistant/navigation";
import { buildInvestmentDataReadiness } from "@/lib/investment-assistant/readiness";
import { normalizeRuntimeState } from "@/lib/investment-assistant/runtime";
import {
  emptyInvestmentAssistantState,
  type FilingProvenanceState,
  type InvestmentA2UIComponent,
  type InvestmentAssistantState,
  normalizeInvestmentA2UISurface,
} from "@/lib/investment-assistant/types";
import { generateUUID } from "@/lib/utils";

const AGENT_ID = "investment-assistant";
const investmentAssistantCustomMessages: ReactCustomMessageRenderer[] = [
  {
    agentId: AGENT_ID,
    render: InvestmentAssistantChatPanelsMessage,
  },
];

function InvestmentAssistantWorkspacePanels({
  state,
  keyItems,
  filings,
  graphEvidence,
  dashboardComponents,
}: {
  state: InvestmentAssistantState;
  keyItems: unknown[];
  filings: Array<{
    accessionNo: string;
    formType: string;
    filingDate?: string | null;
    provenance?: FilingProvenanceState;
  }>;
  graphEvidence: Array<{
    filingId?: string | null;
    itemCode?: string | null;
    citationLabel?: string | null;
    nodeType?: string | null;
    text: string;
  }>;
  dashboardComponents: InvestmentA2UIComponent[];
}) {
  const stanceVariant =
    state.brief?.stance === "positive"
      ? "default"
      : state.brief?.stance === "mixed"
        ? "secondary"
        : "outline";

  const selectedFilingTitle = useMemo(() => {
    if (!state.selectedFiling) {
      return "No filing selected yet. Start with a company name, ticker, or CIK.";
    }

    return `${state.selectedFiling.companyName} ${state.selectedFiling.formType}`;
  }, [state.selectedFiling]);
  const dataReadiness = buildInvestmentDataReadiness(state);

  return (
    <div className="grid min-h-[70vh] grid-cols-1 gap-4">
      {state.runtime.issues.length > 0 ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">Runtime Status</CardTitle>
              <Badge variant="destructive">Degraded</Badge>
            </div>
            <CardDescription>
              Some backend dependency failed during the latest assistant turn.
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

      <InvestmentDataReadinessCard readiness={dataReadiness} />

      <Card className="border-border bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Selected Filing</CardTitle>
          <CardDescription>
            The active report, filing ladder, and current thesis stance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {state.selectedFiling ? (
            <>
              <div className="space-y-1">
                <div className="font-medium text-foreground">
                  {selectedFilingTitle}
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
              No filing selected yet. Start with a company name, ticker, or CIK.
            </p>
          )}

          {filings.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recent Filings
              </div>
              {filings.slice(0, 4).map((filing) => (
                <div
                  className="rounded-xl border border-border bg-muted/70 px-3 py-2"
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

      <InvestmentDecisionQualityCard decisionQuality={state.decisionQuality} />

      <Card className="border-border bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Graph Evidence</CardTitle>
          <CardDescription>
            Grounded snippets coming from the parser&apos;s Neo4j-backed
            retrieval layer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {state.graph?.answer ? (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-3 text-foreground">
              {state.graph.answer}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Graph evidence appears here after the assistant queries the filing
              graph.
            </p>
          )}

          {graphEvidence.slice(0, 4).map((evidence) => (
            <div
              className="rounded-xl border border-border bg-card px-3 py-3"
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
                {evidence.text.slice(0, 180)}
                {evidence.text.length > 180 ? "..." : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="min-h-[320px] border-border bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">A2UI Dashboard</CardTitle>
          <CardDescription>
            Persistent investment workbench rendered from shared agent state.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[420px] overflow-hidden">
          {state.dashboard ? (
            <InvestmentA2UIViewer
              className="h-full overflow-auto rounded-2xl border border-border bg-muted/35 p-3"
              components={dashboardComponents}
              data={state.dashboard.data}
              root={state.dashboard.root}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/35 px-6 text-center text-sm text-muted-foreground">
              Ask for a filing summary or investment brief to generate the A2UI
              dashboard.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InvestmentAssistantPanels({ threadId }: { threadId: string }) {
  const router = useRouter();
  const { agent } = useAgent({
    agentId: AGENT_ID,
  });
  const agentState = (agent?.state ?? {}) as Partial<InvestmentAssistantState>;
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const state: InvestmentAssistantState = {
    ...emptyInvestmentAssistantState,
    ...agentState,
    filings: Array.isArray(agentState.filings) ? agentState.filings : [],
    selectedFiling: agentState.selectedFiling ?? null,
    reader: agentState.reader ?? null,
    graph: agentState.graph ?? null,
    brief: agentState.brief ?? null,
    decisionQuality: agentState.decisionQuality ?? null,
    dashboard: normalizeInvestmentA2UISurface(agentState.dashboard),
    runtime: normalizeRuntimeState(agentState.runtime),
    lastUserIntent: agentState.lastUserIntent ?? null,
    lastUpdatedAt: agentState.lastUpdatedAt ?? null,
  };
  const filings = state.filings;
  const keyItems = Array.isArray(state.reader?.keyItems)
    ? state.reader?.keyItems
    : [];
  const graphEvidence = dedupeGraphEvidence(state.graph?.evidenceBundle);
  const dashboardComponents = Array.isArray(state.dashboard?.components)
    ? state.dashboard?.components
    : [];

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Latest 10-K",
        message: "Show Apple's latest 10-K and explain the key risks.",
      },
      {
        title: "Investment Brief",
        message:
          "Build an investment brief for NVIDIA using its latest annual filing.",
      },
      {
        title: "Quarterly Check",
        message:
          "Open Tesla's latest 10-Q and summarize what changed in the business outlook.",
      },
    ],
  });

  return (
    <div className="min-h-[calc(100dvh-1rem)] bg-background p-2 md:p-4">
      <div className="grid min-h-[calc(100dvh-2rem)] grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,420px)]">
        <section className="flex min-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)]">
          <div className="border-b border-border px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Investment Assistant
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Filing-first investment copilot
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Ask for a filing, grounded graph evidence, or an investment
                  decision framework. The right panel stays synchronized through
                  AG-UI shared state.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  aria-label="New Chat"
                  className="gap-2"
                  onClick={() =>
                    router.push(createInvestmentAssistantThreadPath())
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <PlusIcon />
                  <span>New Chat</span>
                </Button>

                <Sheet onOpenChange={setIsInfoOpen} open={isInfoOpen}>
                  <SheetTrigger asChild>
                    <Button className="xl:hidden" size="sm" variant="outline">
                      정보 보기
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    className="w-[min(92vw,430px)] overflow-y-auto"
                    side="right"
                  >
                    <SheetHeader>
                      <SheetTitle>Workspace Snapshot</SheetTitle>
                      <SheetDescription>
                        채팅창 외부 정보(선택한 파일, Evidence, A2UI 대시보드)를
                        확인하세요.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4">
                      <InvestmentAssistantWorkspacePanels
                        dashboardComponents={dashboardComponents}
                        filings={filings}
                        graphEvidence={graphEvidence}
                        keyItems={keyItems}
                        state={state}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 px-2 pb-3 md:px-4">
            <CopilotChat
              agentId={AGENT_ID}
              className="h-full min-h-0"
              input={{
                addMenuButton: {
                  "aria-label": "Add attachments",
                  title: "Add attachments",
                },
                sendButton: {
                  "aria-label": "Send message",
                  title: "Send message",
                },
              }}
              labels={{
                modalHeaderTitle: "SEC Filing Copilot",
                welcomeMessageText:
                  "Ask for a company filing, graph-grounded evidence, or an investment brief.",
                chatInputPlaceholder:
                  "Example: Summarize NVIDIA's latest 10-K and build a cautious thesis.",
              }}
              threadId={threadId}
              welcomeScreen={false}
            />
          </div>
        </section>

        <aside className="hidden xl:grid">
          <InvestmentAssistantWorkspacePanels
            dashboardComponents={dashboardComponents}
            filings={filings}
            graphEvidence={graphEvidence}
            keyItems={keyItems}
            state={state}
          />
        </aside>
      </div>
    </div>
  );
}

export function InvestmentAssistantWorkspace() {
  const searchParams = useSearchParams();
  const fallbackThreadIdRef = useRef<string>(generateUUID());
  const threadId = searchParams.get("thread") ?? fallbackThreadIdRef.current;

  return (
    <CopilotKitProvider
      a2ui={{}}
      key={threadId}
      renderCustomMessages={investmentAssistantCustomMessages}
      runtimeUrl="/api/copilotkit"
    >
      <InvestmentAssistantPanels key={threadId} threadId={threadId} />
    </CopilotKitProvider>
  );
}
