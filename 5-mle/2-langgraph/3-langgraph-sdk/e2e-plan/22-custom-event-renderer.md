# 22 Custom Event Renderer E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` includes a valid `OPENAI_API_KEY` for the final answer step.
- The LangGraph server exposes the `custom_event_renderer` graph.
- Example navigation includes `22 Custom Event Renderer`.
- The SDK client streams with both `updates` and `custom` modes.

## User Actions

1. Open the app and select `22 Custom Event Renderer`.
2. Confirm the default API URL, `Task ID`, `Task prompt`, action buttons, renderer panels, final panels, and debug panels are present.
3. Click `Use warning sample`, append a unique E2E marker to the task prompt, and set a unique task id.
4. Click `Run renderer`.
5. Wait for inline custom event rendering to show phase, progress, status, warning, and unknown diagnostic payloads.
6. Wait for the OpenAI-backed final answer and final state to populate.

## Expected UI States

- `Renderer Status` shows lifecycle status for the current renderer run and reaches a completed or final state.
- `Inline Event Renderer` shows custom events inline and visually separate from the final assistant answer.
- `Phase Progress` shows phase/progress/status updates from custom events.
- `Warning Events` shows warning payloads when the warning sample is used.
- `Unknown Event Inspector` preserves an unknown diagnostic event with inspectable raw payload details.
- `Final Answer` contains a non-empty assistant response.
- `Final State` includes the task id, task prompt, renderer status, phase/progress data, warning events, unknown events, answer, and final status fields.
- `Raw Stream Events` shows both `updates` and `custom` events.

## Backend Assertions

- Stream requests target graph id `custom_event_renderer`.
- Stream mode includes `updates` and `custom`.
- The stream request body includes the unique task id and E2E marker.
- Custom stream events include phase, progress, status, warning, and unknown diagnostic payloads.
- Final graph state includes renderer output fields instead of relying on assistant text for progress rendering.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique task id and prompt marker.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
