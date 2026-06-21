# 06 Human-in-the-loop / Interrupt UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `human_in_the_loop_interrupt` graph.

## User Actions

1. Open the app and select `06 Human-in-the-loop / Interrupt UI`.
2. Confirm the default API URL and high-risk action prompt are present.
3. Start the default action: `delete production database backup after summarizing risk`.
4. Wait for the run to pause at an interrupt and show the approval payload.
5. Edit the action text and click `Approve edited action`.
6. Wait for `Run complete` and confirm the same thread id remains visible.
7. Repeat a smaller flow that starts the default action, rejects the interrupt, and reaches `Run complete`.

## Expected UI States

- Status changes to `Interrupted` while waiting for human input, and `Run complete` only after resume.
- The interrupt panel shows approval payload details, the original risky action, and `Approve`, `Reject`, and `Approve edited action` controls.
- Editing before approval resumes with the edited action and final result includes `EXECUTED`.
- Rejecting resumes the same interrupted thread and final result includes `BLOCKED`.
- Raw Stream Events is visible and records interrupt and resume events.
- Pending interrupt thread metadata is stored for refresh recovery through a `Recover pending interrupt` action or an equivalent automatic restore path.

## Backend Assertions

- `human_in_the_loop_interrupt` streams successfully through the SDK client.
- The graph interrupts before executing the high-risk action.
- Resume payloads distinguish approval, rejection, and edited approval.
- Final graph state keeps the approval decision, action text, result status, and thread continuity.

## Cleanup

- The browser flow may leave in-memory threads in the dev server.
- Clear localStorage-backed pending interrupt metadata when the UI exposes reset or after test isolation.
