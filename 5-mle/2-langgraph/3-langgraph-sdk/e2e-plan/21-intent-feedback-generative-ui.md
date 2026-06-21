# 21 Intent Feedback with Generative UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` includes a valid `OPENAI_API_KEY` for the completion step.
- The LangGraph server exposes the `intent_feedback_generative_ui` graph.
- Example navigation includes `21 Intent Feedback with Generative UI`.
- The SDK client streams with both `updates` and `custom` modes.

## User Actions

1. Open the app and select `21 Intent Feedback with Generative UI`.
2. Confirm the default API URL, `Investor request` textarea, action buttons, generated UI area, result panels, and debug panels are present.
3. Click `Use ambiguous request`, append a unique E2E marker, and click `Run intent check`.
4. Wait for the ambiguous run to produce missing-field feedback and generated controls for `Ticker`, `Market`, and `Period`.
5. Select generated choices such as `AAPL`, `NASDAQ`, and `1D`, then click `Continue with selections`.
6. Wait for the OpenAI-backed completion to populate completed intent, quote snapshot, final answer, intent events, final state, and raw stream events.

## Expected UI States

- `Intent Status` shows the ambiguous request as incomplete and lists missing fields before selections are submitted.
- `Generated UI Request` renders structured controls for `Ticker`, `Market`, and `Period`, with visible choices such as `AAPL`, `NVDA`, `NASDAQ`, `NYSE`, `1D`, and `1M`.
- Before continuation, `Completed Intent`, `Quote Snapshot`, and `Final Answer` do not show a completed quote response.
- After continuation, `Completed Intent` shows the selected ticker, market, and period.
- `Quote Snapshot` shows the selected symbol and quote data.
- `Intent Events` includes custom lifecycle events for UI request generation, selection handling, quote lookup, and answer generation.
- `Final Answer` contains a non-empty assistant response.
- `Final State` includes `intent`, `missing_fields`, `ui_requests`, `selection`, `quote_snapshot`, `answer`, `final`, `intent_events`, and `final_status`.
- `Raw Stream Events` shows both `updates` and `custom` events.

## Backend Assertions

- Stream requests target graph id `intent_feedback_generative_ui`.
- Stream mode includes `updates` and `custom`.
- The ambiguous run request body includes the unique E2E marker.
- The ambiguous run returns `ui_requests` and `missing_fields` without a final quote answer.
- The continuation request body includes the selected ticker, market, and period.
- Final graph state includes all required intent feedback keys.
- Custom stream events include generated UI and final completion lifecycle payloads.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique request marker.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
