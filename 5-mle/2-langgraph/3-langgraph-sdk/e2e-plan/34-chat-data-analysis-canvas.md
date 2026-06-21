# 34 Chat Data Analysis Canvas E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- LangGraph dev serves `chat_data_analysis_canvas` at `http://localhost:2931`.
- The example is selectable from the left navigation.

## Surface Checks

- Verify controls for LangGraph API URL, analysis request, dataset name, CSV file upload, CSV data preview/editing, run, reset, and retry.
- Verify panels for status, chat transcript, dataset preview, generated code, result table, chart canvas, sandbox logs, retry controls, analysis steps, insights, analysis events, final state, and raw stream events.

## Main Flow

1. Select example 34.
2. Upload a CSV fixture containing a unique marker and channel metrics.
3. Run analysis.
4. Assert the UI shows parsed rows/columns, generated sandbox code, result rows, chart bars, sandbox logs, completed analysis steps, insights, custom events, and final state.
5. Trigger retry on the same thread.
6. Assert retry count increases, retry/final status appears, sandbox logs mention retry, and final state keeps analysis outputs.

## Backend Assertions

- Stream requests target graph id `chat_data_analysis_canvas`.
- Requests use `updates` and `custom` stream modes.
- Request bodies include the marker, uploaded CSV text, analyze action, and retry action.
- Raw stream events include `updates` and `custom`.

## Cleanup

- No persistent files or external artifacts are created.
- In-memory LangGraph threads may remain after the test run.
