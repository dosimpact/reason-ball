# 04 Streaming UI

## Coding Scope

- Graph: `graphs/04_streaming_ui.py` adapts `07_streaming` and `18_custom_streaming`.
- Frontend: `src/examples/04-streaming-ui/` compares stream modes in a single view.

## Implementation Plan

1. Build a graph that can emit message tokens, state updates, final values, and custom progress events.
2. Add a segmented control for `messages`, `updates`, `values`, and `custom`.
3. Render mode-specific panels without hiding the raw event log.
4. Keep the same prompt runnable across modes for side-by-side learning.

## SDK And State Notes

Use the LangGraph SDK stream mode option and keep mode-specific parsers isolated. Do not treat every stream payload as chat text.

## Risks

- Different stream modes expose different payload shapes, so shared parsing must not erase mode-specific data.
- Token streaming can finish before React renders intermediate states unless updates are buffered carefully.

## Acceptance Criteria

- A user can run the same input in each stream mode.
- Token output, state updates, values, and custom events appear in distinct UI regions.
- Unknown event shapes are retained in a raw debug panel.
