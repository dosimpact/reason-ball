# 42 Agentic Chat Reasoning AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full reasoning tool execution requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify reasoning status panel renders.
- Verify visible contract states that hidden chain-of-thought is not requested.
- Verify suggestions include `Show reasoning summary` and `Policy fact`.

## Main Flow

1. Select example 42.
2. Assert `data-testid="reasoning-status-panel"` is visible.
3. Assert public-summary language is visible.
4. Assert Copilot chat controls and suggestions are visible.

## Backend Assertions

- Live execution should target graph id `agentic_chat_reasoning`.
- Rendered reasoning content should come from public summary tool payloads only.

## Cleanup

- Surface-only checks do not create persistent data.
