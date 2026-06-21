# 37 Human in the Loop AG-UI

## Coding Scope

- Graph: `graphs/37_human_in_the_loop_ag_ui.py` implements a Python LangGraph workflow that interrupts for user approval before completing a task plan.
- Frontend: `src/examples/37-human-in-the-loop-ag-ui/` renders a CopilotKit chat surface plus approval, edit, and reject controls.
- Runtime: reuse the shared CopilotKit runtime and Python LangGraph server.

## Implementation Plan

1. Add a `human_in_the_loop_ag_ui` graph with a planning node, an interrupt/approval node, and an execution node.
2. Use LangGraph interrupt/resume semantics so the graph pauses with a structured payload containing task title, proposed steps, risk note, and allowed actions.
3. Register the graph in `langgraph.json` and expose it to CopilotKit with agent name `human_in_the_loop_ag_ui`.
4. Add a React example that renders the interrupt payload as an approval panel inside or beside the chat.
5. Implement approve, reject, and edit-and-approve actions that resume the same thread with the selected decision payload.
6. Preserve pending approval state across refresh by reading the active thread/run state when the example mounts.

## SDK And State Notes

The authoritative approval state is in the LangGraph thread. React may keep draft edits locally, but must send the final resume payload back to the same thread instead of starting a new run.

## Risks

- CopilotKit chat abstractions may hide pending LangGraph interrupts unless the runtime exposes enough run/thread state.
- Resume payload shape must match the Python graph exactly.
- Refresh recovery can fail if the frontend tracks pending state only in component memory.

## Acceptance Criteria

- The Human in the Loop AG-UI example appears as example 37 in the navigation.
- A representative prompt pauses the graph and shows a structured approval UI.
- Approve resumes the same thread and completes the task.
- Edit-and-approve resumes with the edited steps visible in the final answer.
- Reject ends the run with a clear rejected/cancelled state.
