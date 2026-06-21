# 31 Chat Plan Board E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934`.
- The LangGraph server exposes the `chat_plan_board` graph.
- Example navigation includes `31 Chat + Plan Board`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.

## User Actions

1. Open the app and select `31 Chat + Plan Board`.
2. Confirm the API URL, goal, revision note, run, reset, board action buttons, and result panels are present.
3. Enter a unique marker in the goal.
4. Click `Run plan board`.
5. Wait for planned status, populated board columns, execution log, plan events, final state, and raw stream events.
6. Click `Continue execution`.
7. Wait for the board to advance the active step and create version `v2`.
8. Click `Replan board`.
9. Wait for the reviewer checkpoint and version `v3`.
10. In a separate flow, create a board and drag `Validate handoff` from `pending` to `blocked`.
11. Wait for `user-edited` board status, version `v2`, execution log, and final state to reflect the direct move.
12. Click `Continue execution` and confirm the blocked card remains in the `blocked` column.

## Expected UI States

- `Plan Board Status` shows planned, continued, and replanned status transitions.
- `Plan Board` renders completed, active, pending, blocked, and failed columns.
- Dragging a card to another status column saves the move and re-renders the card in the target column.
- Continuing after a direct board edit preserves blocked or failed manual statuses.
- `Execution Log` records completed step transitions.
- `Version History` shows sequential plan versions.
- `Plan Events` renders custom progress events.
- `Final State` preserves marker, plan steps, active step id, version history, and artifact version.

## Backend Assertions

- Stream requests target graph id `chat_plan_board`.
- Stream mode includes `updates` and `custom`.
- The first request includes the marker and `action: "create"`.
- Follow-up requests include `action: "continue"` and `action: "revise"` on the same thread.
- Direct drag/drop sends `action: "move_step"` with `step_id` and `target_status` on the same thread.
- Final graph state reports `final_status: "replanned"` and `artifact_version: 3`.
- Direct edit graph state reports `board_status: "user-edited"` and appends a new artifact version.

## Cleanup

- Each test clears browser storage before selecting the example.
- The graph stores plan board versions in LangGraph thread state only.
