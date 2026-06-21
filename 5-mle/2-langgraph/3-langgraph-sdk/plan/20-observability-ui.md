# 20 Observability UI

## Coding Scope

- Graph: `graphs/20_observability.py` adapts `20_history_reducer` and observability examples.
- Frontend: `src/examples/20-observability-ui/` renders metrics and trace links.

## Implementation Plan

1. Capture node timing, token usage where available, cost estimates, and run metadata.
2. Add a metrics panel with totals and per-node rows.
3. Render LangSmith trace links when environment config provides them.
4. Keep raw metadata available for debugging.

## SDK And State Notes

Use run metadata, stream timing, and provider usage metadata. Treat missing token data as unknown, not zero.

## Risks

- Token and cost metadata can be unavailable depending on provider response.
- LangSmith links require optional environment configuration.

## Acceptance Criteria

- Completed runs show latency and node elapsed time.
- Token/cost fields handle missing data safely.
- LangSmith links appear only when available.
