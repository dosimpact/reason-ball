# 31 Chat Plan Board

## Coding Scope

- Graph: `graphs/31_chat_plan_board.py` combines plan-and-execute with streaming updates and checkpoints.
- Frontend: `src/examples/31-chat-plan-board/` renders chat plus plan board.

## Implementation Plan

1. Convert user goals into structured plan steps.
2. Stream execution updates into a board with step statuses.
3. Allow user edits through direct board drag/drop and replan requests through chat.
4. Checkpoint plan state before and after major changes.

## SDK And State Notes

Use step ids for stable board rendering. Persist direct board moves through the same LangGraph thread with a `move_step` action, version history, custom board-edit events, and execution log entries.

## Risks

- Replanning can invalidate running steps; require clear state transitions.
- User edits must be preserved when the graph continues.

## Acceptance Criteria

- Chat can create and revise a plan.
- Users can drag plan cards between status columns and persist the edit.
- The board shows active, completed, failed, and pending steps.
- Execution can continue after a user revision.
