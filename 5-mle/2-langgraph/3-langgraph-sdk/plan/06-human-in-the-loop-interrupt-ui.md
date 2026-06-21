# 06 Human-in-the-loop Interrupt UI

## Coding Scope

- Graph: `graphs/06_human_in_the_loop_interrupt.py` adapts `05_interrupt`, `16_command_interrupt`, and `25_approval_system`.
- Frontend: `src/examples/06-human-in-the-loop-interrupt-ui/` handles pending interrupt runs.

## Implementation Plan

1. Create a graph that interrupts with an approval payload before a sensitive action.
2. Render interrupt payload, approve, reject, and edit-then-approve actions.
3. Resume with `Command(resume=...)` through the SDK.
4. On refresh, detect pending thread/run state and restore the action panel.

## SDK And State Notes

Track run id, thread id, interrupt payload, and resume payload. Keep approval decisions in graph state for final display.

## Risks

- Duplicate resume actions can corrupt the learning flow; resume buttons need disabled/loading states.
- Pending interrupt recovery depends on stable thread and run references after refresh.

## Acceptance Criteria

- A run stops at interrupt and does not complete until user action.
- Approval, rejection, and edited approval each resume the same thread.
- Refreshing the page does not lose the pending interrupt.
