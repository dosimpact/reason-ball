# 25 push_ui_message Example

## Coding Scope

- Graph: `graphs/25_push_ui_message.py` demonstrates `push_ui_message` payloads.
- Frontend: `src/examples/25-push-ui-message/` renders UI messages as chat components.

## Implementation Plan

1. Emit at least two UI message payloads from graph execution.
2. Define a frontend registry for supported UI message types.
3. Render cards, action buttons, or compact summaries inline in chat.
4. Fall back to raw JSON for unsupported UI message types.

## SDK And State Notes

Reference the official `push_ui_message` behavior and keep payload schemas versioned.

## Risks

- `push_ui_message` API behavior may differ by installed LangGraph version.
- UI payload rendering must be whitelisted to avoid arbitrary component execution.

## Acceptance Criteria

- UI messages appear in chronological chat flow.
- Non-text payload fields drive actual component rendering.
- Unsupported payloads do not crash the chat view.
