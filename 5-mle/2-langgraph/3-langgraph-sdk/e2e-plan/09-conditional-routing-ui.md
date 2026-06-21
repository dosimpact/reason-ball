# 09 Conditional Routing UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `conditional_routing` graph.
- Example navigation includes `09 Conditional Routing UI`.
- The UI provides a request textarea, sample buttons for `Translation`, `Summary`, and either `Support` or `Research`, plus a `Run conditional route` button.

## User Actions

1. Open the app and select `09 Conditional Routing UI`.
2. Confirm the default API URL and request textarea are present.
3. Confirm sample buttons for `Translation`, `Summary`, and `Support` or `Research` are visible.
4. Keep the default request and click `Run conditional route`.
5. Wait for `Run complete`.
6. Review `Route Decision`, `Branch Map`, `Branch Result`, `Final State`, and `Raw Stream Events`.
7. Select a different sample input from the first selected route.
8. Click `Run conditional route` again.
9. Wait for completion and confirm the new selected branch is reflected in the route decision and branch map.

## Expected UI States

- Status changes through the run lifecycle and reaches `Run complete`.
- `Route Decision` displays the selected branch and a visible route reason.
- `Branch Map` keeps all branch cards visible after routing.
- The selected branch card is visibly marked as selected.
- Skipped branch cards remain visible and are marked as skipped or inactive.
- `Branch Result` is visible and contains non-empty output for the selected branch.
- `Final State` includes selected branch data and skipped branch data.
- Raw Stream Events is visible and contains streamed route, branch, update, or value events.
- Running a different deterministic sample changes the selected branch or shows the new selected branch label.

## Backend Assertions

- `conditional_routing` streams successfully through the SDK client.
- The graph writes explicit route metadata before final output, including selected branch, skipped branches, and reason.
- Default and alternate sample requests deterministically select different branches.
- The selected branch writes a branch-specific result into final state.
- Skipped branches remain represented in state without executing their branch result.
- Stream events include route decision, branch execution, final values, and run completion data.

## Cleanup

- The browser flow may leave in-memory thread and run data in the dev server.
- No persistent external data is created.
- Test isolation should clear page storage between Playwright tests if the UI stores selected sample, route decision, or branch state locally.
