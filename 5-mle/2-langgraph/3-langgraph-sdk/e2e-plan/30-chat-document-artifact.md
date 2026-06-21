# 30 Chat Document Artifact E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934`.
- The LangGraph server exposes the `chat_document_artifact` graph.
- Example navigation includes `30 Chat + Document Artifact`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.

## User Actions

1. Open the app and select `30 Chat + Document Artifact`.
2. Confirm the API URL, document request, tone, length, focus section, run, reset, and result panels are present.
3. Enter a unique marker in the document request.
4. Select a deterministic tone, length, and focus section.
5. Click `Run document agent`.
6. Wait for document canvas, section changes, AI comments, quality review, final state, and raw stream events.
7. Edit the Overview section directly in `Document Canvas`.
8. Click `Save user edits` and verify the saved user text remains in state.
9. Click `Ask AI to revise canvas` and verify the AI revises the current user-edited canvas.
10. Click `Approve document`.
11. Wait for applied status and version history.

## Expected UI States

- `Document Canvas` renders structured document sections.
- `Document Canvas` exposes editable title, summary, and section fields.
- User-edited section text is saved to graph state with `last_editor: "user"`.
- AI revision updates the same canvas with `last_editor: "ai"`.
- `Section Changes` shows section-level edit summaries.
- `AI Comments` shows review comments with section ids.
- `Quality Review` shows passed checks and score.
- `Approval Controls` applies the proposed document only after explicit approval.
- `Version History` shows `v1` after approval.
- `Final State` preserves marker, tone, length, focus section, sections, comments, checks, approval log, and artifact version.

## Backend Assertions

- Stream requests target graph id `chat_document_artifact`.
- Stream mode includes `updates` and `custom`.
- The first request includes the marker, tone, length, and focus section.
- A follow-up request includes `action: "save_user_edit"` and the edited section text.
- A follow-up request includes `action: "ai_revise"` and the current canvas sections.
- The approval request includes `approval: "approve"`.
- Final graph state reports `final_status: "applied"` and `artifact_version: 1`.

## Cleanup

- Each test clears browser storage before selecting the example.
- The graph stores sample document versions in memory only.
