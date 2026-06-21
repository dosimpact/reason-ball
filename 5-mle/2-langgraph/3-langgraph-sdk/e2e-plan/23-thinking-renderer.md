# 23 Thinking Renderer E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` includes a valid `OPENAI_API_KEY` if the provider-backed final answer path is used.
- The LangGraph server exposes the `thinking_renderer` graph.
- Example navigation includes `23 Thinking Renderer`.
- The SDK client streams with both `updates` and `custom` modes.

## User Actions

1. Open the app and select `23 Thinking Renderer`.
2. Confirm the default API URL, `Thinking prompt`, action buttons, thinking panels, final panels, and debug panels are present.
3. Click `Use analysis sample` and append a unique E2E marker to the thinking prompt.
4. Click `Run thinking renderer`.
5. Wait for streamed custom events to render visible thinking/status blocks before the final answer is shown.
6. Confirm collapsible thinking details are available for inspecting public reasoning/status summaries.
7. Wait for the final answer, final state, and raw stream events to populate.

## Expected UI States

- `Thinking Status` shows lifecycle status for the current thinking renderer run.
- `Thinking Timeline` shows visible public thinking/status steps before the final answer is complete.
- `Public Reasoning Summary` shows a concise reasoning summary that is separate from the final answer.
- `Safety Guardrails` explains that hidden chain-of-thought or private reasoning is not exposed.
- Collapsible thinking details are present in the thinking timeline or public reasoning summary area.
- `Final Answer` contains a non-empty assistant response and does not render raw thinking state or stream payloads.
- `Final State` includes `question`, `thinking_steps`, `reasoning_summary`, `safety_guardrails`, `answer`, `final`, and `final_status`.
- `Raw Stream Events` shows both `updates` and `custom` events.

## Backend Assertions

- Stream requests target graph id `thinking_renderer`.
- Stream mode includes `updates` and `custom`.
- The stream request body includes the unique E2E marker.
- Custom stream events include thinking/status payloads before the final answer is rendered.
- Final graph state includes public thinking renderer fields instead of hidden chain-of-thought content.

## Safety Assertions

- Thinking and final answer panels must not expose hidden chain-of-thought text.
- The phrases `hidden chain-of-thought`, `private reasoning`, `internal reasoning transcript`, and `step-by-step hidden reasoning` are only allowed when they appear in a guardrail sentence that explicitly says they are not exposed, shown, displayed, surfaced, or revealed.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique prompt marker.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
