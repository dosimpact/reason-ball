# 33 Chat UI Preview E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934`.
- The LangGraph server exposes the `chat_ui_preview` graph.
- Example navigation includes `33 Chat + UI Preview`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.

## User Actions

1. Open the app and select `33 Chat + UI Preview`.
2. Confirm the API URL, UI request, run, reset, approval buttons, and result panels are present.
3. Enter a unique marker in the UI request.
4. Click `Run UI preview`.
5. Wait for live preview, component code, diff, component tree, style controls, preview events, and final state.
6. Click `Apply preview`.
7. Wait for applied status and version `v1`.
8. Run a second preview request and click `Revert preview`.
9. Wait for reverted status without creating a new version.

## Expected UI States

- `Live Preview` renders sandboxed markup without executing scripts.
- `Component Code` and `Diff Preview` show proposed React component changes.
- `Component Tree` shows component structure.
- `Style Controls` shows theme/accent/density decisions.
- `Approval Controls` applies or reverts the proposal.
- `Version History` records applied versions only.

## Backend Assertions

- Stream requests target graph id `chat_ui_preview`.
- Stream mode includes `updates` and `custom`.
- The first request includes the marker and `action: "generate"`.
- Follow-up requests include `action: "apply"` with `approval: "approve"` and `action: "revert"` with `approval: "revert"`.
- Final state reports applied/reverted status and memory-only artifact fields.

## Cleanup

- Each test clears browser storage before selecting the example.
- UI preview artifacts are kept in LangGraph thread state only.
