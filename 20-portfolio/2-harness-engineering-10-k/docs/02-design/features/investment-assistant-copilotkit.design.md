# Investment Assistant CopilotKit Integration Design

## Architecture

The integrated assistant is split into three layers:

1. `3-10-k-parser`
   Provides Graph RAG retrieval APIs backed by Neo4j.

2. `4-10-k-chat-bot-next`
   Hosts the CopilotKit runtime, filing access utilities, investment-brief orchestration, and the user-facing workspace.

3. `2-10-k-collector`
   Remains the source of truth for company lookup, filing metadata, and local filing files consumed by the chat app.

## Runtime Flow

1. User asks a question in CopilotKit chat.
2. Next.js CopilotKit runtime routes the request to `investment-assistant` agent.
3. The agent resolves company / filing context from:
   - current AG-UI shared state
   - collector Postgres metadata
   - latest user utterance
4. The agent calls parser Graph RAG API for grounded evidence.
5. The agent optionally builds a filing summary or investment brief from the selected filing.
6. The agent emits:
   - text response
   - `STATE_SNAPSHOT` with selected filing, evidence, and dashboard model
   - `ACTIVITY_SNAPSHOT` containing an A2UI surface
7. The workspace re-renders:
   - Copilot chat transcript
   - persistent filing/evidence/brief panels from AG-UI state
   - A2UI viewer for the investment dashboard

## Parser API Design

### Endpoint

`POST /api/graph-rag/query`

### Request

```json
{
  "query": "What are the main risks in Apple's latest 10-K?",
  "companyQuery": "Apple",
  "ticker": "AAPL",
  "cik": "0000320193",
  "accessionNo": "0000320193-25-000073",
  "filingId": "acc:0000320193-25-000073",
  "evidenceLimit": 8
}
```

### Response

```json
{
  "intent": "risk",
  "selectedFiling": {
    "filingId": "acc:...",
    "accessionNo": "...",
    "companyName": "Apple Inc.",
    "ticker": "AAPL",
    "cik": "0000320193",
    "formType": "10-K",
    "filingDate": "2025-11-01"
  },
  "answer": "Grounded summary...",
  "evidenceBundle": [
    {
      "citationLabel": "Item 1A",
      "nodeType": "Risk",
      "text": "...",
      "itemCode": "1A",
      "filingId": "acc:...",
      "companyName": "Apple Inc.",
      "score": 0.9,
      "reason": "risk retrieval match"
    }
  ]
}
```

### Retrieval Rules

- If `filingId` or `accessionNo` exists, use that filing directly.
- Otherwise resolve the most recent filing for the matched company in graph.
- Intent routing:
  - `risk`: prefer `Risk` nodes
  - `metric`: prefer `Metric` nodes
  - `brief` / `summary`: prefer section text + risks + metrics mixed evidence
- Always return explicit uncertainty when no grounded evidence is found.

## Shared State Model

```ts
type InvestmentAssistantState = {
  companyQuery: string | null;
  selectedFiling: {
    accessionNo: string;
    companyName: string;
    ticker: string | null;
    cik: string;
    formType: string;
    filingDate: string | null;
    filingUrl: string;
  } | null;
  reader: {
    toc: Array<{ itemCode: string; title: string }>;
    keyItems: Array<{ itemCode: string; title: string }>;
    preview: string;
  } | null;
  graph: {
    intent: string | null;
    answer: string | null;
    evidenceBundle: Array<{
      citationLabel: string;
      nodeType: string;
      text: string;
      itemCode: string | null;
      filingId: string | null;
      companyName: string | null;
      score: number;
      reason: string;
    }>;
  } | null;
  brief: {
    stance: "positive" | "mixed" | "cautious";
    conclusion: string;
    bull: string[];
    bear: string[];
    unknowns: string[];
    nextChecks: string[];
  } | null;
  dashboard: {
    root: string;
    components: unknown[];
    data: Record<string, unknown>;
  } | null;
};
```

## A2UI Design

The dashboard surface contains:

- filing summary header card
- stance card
- bull points card
- bear points card
- uncertainty / next checks card
- graph evidence list

The same dashboard model is:

- emitted as `ACTIVITY_SNAPSHOT` for inline chat rendering
- stored in AG-UI state for persistent right-panel rendering through `A2UIViewer`

## Frontend Composition

### Main Page

`app/(chat)/page.tsx` renders a dedicated investment workspace instead of the legacy plain chat page.

### Workspace Layout

- left: CopilotKit chat
- right top: filing selection and investment brief panels
- right bottom: A2UI dashboard viewer

### CopilotKit Setup

- `CopilotKitProvider` with runtime `/api/copilotkit`
- `CopilotChat` bound to agent id `investment-assistant`
- `useCoAgent` bound to the same agent id for state synchronization
- `useConfigureSuggestions` for filing-oriented starter prompts

## Testing Plan

1. Parser API
   - health check
   - graph-rag query request
   - collector parse job or manifest parse into Neo4j

2. Next.js
   - dependency install
   - typecheck / build
   - runtime startup

3. Browser
   - open workspace with Playwright
   - ask for latest filing
   - verify selected filing panel updates
   - verify evidence appears
   - verify A2UI dashboard renders
   - ask for investment brief follow-up

## Failure Handling

- Missing parser backend URL: show server error with remediation text.
- Missing collector DB / file path: return explicit operational guidance in chat.
- No Graph RAG evidence: fall back to filing-reader-only brief and mark graph evidence as unavailable.
