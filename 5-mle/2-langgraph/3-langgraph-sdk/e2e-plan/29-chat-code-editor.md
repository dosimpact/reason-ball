# 29 Chat Code Editor E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934`.
- The LangGraph server exposes the `chat_code_editor` graph.
- Example navigation includes `29 Chat + Code Editor`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.

## User Actions

1. Open the app and select `29 Chat + Code Editor`.
2. Confirm the API URL, change request, file selector, run, reset, and result panels are present.
3. Enter a unique change request marker and select `app.py`.
4. Click `Run code agent`.
5. Wait for proposal summary, code artifact, diff proposal, test log, editor events, final state, and raw stream events.
6. Click `Approve change`.
7. Wait for applied status and version history.

## Expected UI States

- `Diff Proposal` shows a proposed patch before approval.
- `Test Log` shows deterministic pass records.
- `Approval Controls` keeps approve/reject disabled until a proposal exists, then allows approval.
- `Version History` remains empty before approval and shows `v1` after approval.
- `Final State` includes the request marker, selected file, diff, tests, approval status, artifact version, and final status.
- `Raw Stream Events` includes both `updates` and `custom` entries.

## Backend Assertions

- Stream requests target graph id `chat_code_editor`.
- Stream mode includes `updates` and `custom`.
- The first request includes the unique marker and selected file.
- The approval request includes `approval: "approve"`.
- Final graph state reports `final_status: "applied"` and `artifact_version: 1`.

## Cleanup

- Each test clears browser storage before selecting the example.
- The graph uses memory-only sample artifacts; no repository files are modified.
