# 12 Structured Output UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `structured_output` graph.
- Example navigation includes `12 Structured Output UI`.
- The UI provides a default API URL, request textarea, request sample buttons, and a primary run button named like `Run structured extraction`.

## User Actions

1. Open the app and select `12 Structured Output UI`.
2. Confirm the default API URL and request textarea are present.
3. Confirm at least one request sample button is visible.
4. Keep the default request and click `Run structured extraction`.
5. Wait for `Run complete`.
6. Review `Validation Status`, `Schema`, `Structured Result` or `Extracted Fields`, `Field Table`, `Raw JSON`, `Final State`, and `Raw Stream Events`.

## Expected UI States

- Status changes through the run lifecycle and reaches `Run complete`.
- `Validation Status` shows an explicit success, valid, or passed state for the default sample.
- `Schema` shows the schema name and visible field definitions, including field names and type or required metadata.
- `Structured Result` or `Extracted Fields` is populated with human-readable extracted values.
- `Field Table` is populated with one row per extracted field or nested field group.
- `Raw JSON` contains the parsed structured result in readable JSON form.
- `Final State` contains schema, validation, parsed result, and raw model output or debugging data when available.
- `Raw Stream Events` contains update payloads for schema selection, model output, validation, parsed result, or final state.

## Backend Assertions

- The SDK client streams against graph id `structured_output`.
- The graph returns a stable schema name and schema field metadata with each run.
- The default sample produces valid structured output.
- The graph validates parsed model output server-side and writes validation status or validation errors into state.
- Final graph state includes the schema name, parsed object, validation status, original model text when available, and any validation errors.
- Stream events include `updates` chunks with enough payload detail to debug schema, validation, and parsed result transitions.

## Cleanup

- The browser flow may leave in-memory thread and run data in the dev server.
- No persistent external data is created.
- Test isolation should clear page storage between Playwright tests if the UI stores selected sample, schema expansion state, or run results locally.
