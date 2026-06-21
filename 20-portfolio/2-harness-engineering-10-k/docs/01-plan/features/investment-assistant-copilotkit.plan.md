# Investment Assistant CopilotKit Integration Plan

## Overview

Build an AI assistant that can:

- browse corporate 10-K / 10-Q filings
- use Graph RAG evidence grounded in Neo4j
- guide investment judgment with a Bull / Bear / Unknown / Next Checks framework
- present the workflow through a CopilotKit-based chat workspace

This feature connects four project stages:

- `1-infra-graph-rag`: Neo4j and graph infrastructure
- `2-10-k-collector`: SEC filing metadata and local filing storage
- `3-10-k-parser`: parse, graph projection, retrieval, runtime APIs
- `4-10-k-chat-bot-next`: user-facing assistant UI

## Problem Statement

Current gaps:

1. `4-10-k-chat-bot-next` can proxy messages to the parser runtime, but the user-facing assistant does not expose Graph RAG as a first-class workflow for filing review and investment judgment.
2. SEC filing reader / summary / brief logic exists separately from parser Graph RAG logic, so evidence is fragmented across two parallel paths.
3. CopilotKit is present only as a reference repository and not integrated into the actual chatbot app, so AG-UI shared state and A2UI dashboard rendering are not being used.

## Goals

- Add a Graph RAG API surface that the chatbot can call directly for evidence bundles and investment-oriented reasoning.
- Migrate the main chat landing experience to a CopilotKit workspace.
- Use AG-UI style shared state to keep selected filing, graph evidence, and decision output synchronized in the workspace.
- Use A2UI rendering for an investment dashboard/canvas derived from filing + graph evidence.

## Scope

### In Scope

- Parser Graph RAG query API and investment brief API
- Next.js CopilotKit runtime route
- CopilotKit workspace page as the primary landing experience
- Filing reader, graph evidence, and investment brief tools
- A2UI dashboard rendering for investment workbench
- environment / README updates needed to run the integration

### Out of Scope

- durable CopilotKit conversation persistence replacing existing Drizzle chat history
- multi-company portfolio analytics beyond single-company filing review
- production auth / RBAC redesign
- advanced valuation models or price-target generation

## Functional Requirements

1. Users can request the latest annual or quarterly filing for a company and inspect its contents.
2. Users can ask graph-grounded questions such as risks, metrics, and evidence-backed summaries.
3. Users can request an investment decision brief framed as Bull / Bear / Unknown / Next Checks.
4. Users can open a visual investment dashboard rendered with A2UI data.
5. The Copilot workspace keeps the currently selected filing and latest evidence/brief visible outside the chat transcript.

## Non-Functional Requirements

- Preserve existing parser-backed chat APIs as legacy-compatible paths.
- Keep cross-service coupling explicit through typed APIs.
- Prefer deterministic fallbacks when LLM generation is unavailable.
- Default collector local path resolution must work with the current repo layout.

## Success Criteria

- `4-10-k-chat-bot-next` root page opens a CopilotKit workspace instead of the legacy raw chat page.
- The CopilotKit agent can call tools that read filings and Graph RAG evidence.
- A2UI dashboard renders from tool output in the workspace.
- Parser exposes structured Graph RAG endpoints used by the Next.js app.
- Basic smoke verification completes for parser imports and Next.js typechecking/build context after dependency installation.

## Risks And Mitigations

- CopilotKit package installation may require network access.
  - Mitigation: add dependencies in package manifest and verify after install approval.
- Existing repo has in-progress local modifications.
  - Mitigation: avoid reverting unrelated changes and keep changes scoped to new integration files.
- Graph evidence quality may be shallow for some filings.
  - Mitigation: combine Graph RAG evidence with local filing-reader fallback and surface uncertainty explicitly.

## Architecture Considerations

- Parser remains the Graph RAG source of truth.
- Next.js becomes the orchestration/UI layer.
- Collector Postgres and local filing files remain the source for listing filings and opening raw documents.
- CopilotKit runtime uses the existing AI SDK language model provider from the chat app to avoid introducing a second model stack.
