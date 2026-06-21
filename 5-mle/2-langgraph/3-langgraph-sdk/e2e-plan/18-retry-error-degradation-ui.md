# 18 Retry / Error / Degradation UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY` for graph paths that produce a primary or fallback answer.
- The LangGraph server exposes the `retry_error_degradation` graph.
- Example navigation includes `18 Retry / Error / Degradation UI`.
- The UI provides a default API URL, query textarea, failure mode controls named `Normal`, `Flaky`, `Fallback`, and `Forced failure`, max attempts input, `Enable fallback` checkbox, `Run retry demo` button, and `Reset` button.
- The SDK client streams with `updates` and `custom` modes.

## User Actions

1. Open the app and select `18 Retry / Error / Degradation UI`.
2. Confirm the default API URL and all panels are present: `Run Status`, `Retry Timeline`, `Error Details`, `Fallback Result`, `Retry Events`, `Final Answer`, `Final State`, and `Raw Stream Events`.
3. Enter a unique query that can be recognized in final state without depending on exact LLM wording.
4. Select `Flaky`, set max attempts to `3`, keep fallback enabled, and click `Run retry demo`.
5. Wait for `Run complete`.
6. Verify attempts 1 and 2 show transient recoverable retry/backoff behavior, attempt 3 succeeds, and final status is `success_with_retries` or an equivalent recovered success state.
7. Reset the view, select `Fallback`, set max attempts to `3`, keep fallback enabled, and click `Run retry demo`.
8. Wait for `Run complete`.
9. Verify the primary attempts fail, the fallback path/result is visible, and final status is `fallback_success`.
10. Optional coverage: reset the view, select `Forced failure`, run the demo, and verify final status `failed` with a permanent or not recoverable error.

## Expected UI States

- `Run Status` shows final status, retry status, used strategy, and current attempt.
- `Retry Timeline` shows one visible entry per primary attempt with attempt number, status, error type or message, backoff timing where applicable, and success result where applicable.
- `Error Details` shows structured errors with error type, attempt number, recoverable flag, and message.
- `Fallback Result` shows the fallback answer for fallback mode and may show the primary answer for primary-success modes.
- `Retry Events` shows custom retry lifecycle events, including primary call, retry/backoff, fallback, and succeeded or failed phases.
- `Final Answer` is populated after completion but is not asserted against exact LLM wording.
- `Final State` contains `attempts`, `errors`, `retry_events`, `final_status`, and either `primary_result` or `fallback_result`.
- `Raw Stream Events` contains both `updates` and `custom` stream events, including `retry_status` custom payloads.

## Backend Assertions

- The SDK client streams against graph id `retry_error_degradation`.
- Stream mode includes both `updates` and `custom`.
- Flaky mode sends `failure_mode: flaky_success`, `max_attempts: 3`, and `fallback_enabled: true`.
- Flaky final graph state includes at least three attempts, recoverable transient errors for attempts 1 and 2, retry/backoff events, `primary_result`, and `final_status: success_with_retries`.
- Fallback mode sends `failure_mode: fallback_success`, `max_attempts: 3`, and `fallback_enabled: true`.
- Fallback final graph state includes exhausted primary attempts, recoverable transient errors, fallback events, `fallback_result`, and `final_status: fallback_success`.
- Forced failure mode, when run, sends `failure_mode: final_failure` and should produce a permanent or not recoverable error with `final_status: failed`.
- Custom stream payloads include `type: retry_status`.

## Cleanup

- Each test uses a unique query string and creates a new thread.
- Page storage should be cleared before selecting the example so prior form values, stream logs, selected modes, and thread IDs do not affect the run.
- Tests do not create durable store records and require no backend cleanup beyond normal thread isolation.
