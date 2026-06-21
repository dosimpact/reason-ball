# 21 Intent Feedback Generative UI

## Coding Scope

- Graph: `graphs/21_intent_feedback_generative_ui.py` handles stock price intent validation and UI request payloads.
- Frontend: `src/examples/21-intent-feedback-generative-ui/` renders generated selector components.

## Implementation Plan

1. Parse user input for ticker, market, and period.
2. If fields are missing or ambiguous, emit a UI payload for ticker list, market selector, or period selector.
3. Convert user selections into a new HumanMessage or structured resume payload.
4. Run the completed request and show the resulting answer.

## SDK And State Notes

Represent UI requests as structured state or custom events. Keep generated UI payloads typed and whitelisted.

## Risks

- Generated UI payloads must be schema-checked before rendering.
- Stock ticker examples need mocked or clearly scoped data if no market API is configured.

## Acceptance Criteria

- Ambiguous input produces UI controls instead of only text.
- User selections resume or continue the graph with structured values.
- Completed intent is visible before the final answer.
