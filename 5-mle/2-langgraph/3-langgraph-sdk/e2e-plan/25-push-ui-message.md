# 25 push_ui_message Example E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- The LangGraph server exposes the `push_ui_message_example` graph.
- Example navigation includes `25 push_ui_message Example`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.

## User Actions

1. Open the app and select `25 push_ui_message Example`.
2. Confirm the default API URL, `Prompt` input, sample buttons, `Run push UI message`, `Reset`, chat UI, final state, and raw stream events surfaces are present.
3. Click a sample button, append a unique E2E marker to the prompt, and click `Run push UI message`.
4. Wait for inline chat UI messages to render from pushed non-text payloads.
5. Confirm whitelisted UI message renderers appear for status, card, and action payloads.
6. Click a rendered action button or chip.
7. Confirm an unsupported UI message payload falls back to readable JSON instead of breaking the chat.
8. Wait for `Final State` and `Raw Stream Events` to populate.

## Expected UI States

- The chat surface renders pushed UI messages inline with ordinary chat flow.
- Status UI messages show lifecycle or progress state for the current run.
- Card UI messages render non-text payload fields as a card-like component instead of dumping plain text.
- Action UI messages expose at least one clickable button or chip.
- Unsupported UI message types render a JSON fallback that preserves the unknown payload.
- `Final State` includes `ui`, `ui_render_status`, `final_status`, and the marked prompt.
- `Raw Stream Events` shows both `updates` and `custom` events and includes pushed UI message payloads.

## Backend Assertions

- Stream requests target graph id `push_ui_message_example`.
- Stream mode includes `updates` and `custom`.
- The stream request body includes the unique E2E marker appended to the prompt.
- Custom stream events include UI message payloads for status/card/action rendering.
- Final graph state preserves pushed UI payloads under `ui` and reports `ui_render_status` plus `final_status`.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique prompt marker.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
