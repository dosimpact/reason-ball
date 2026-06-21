# 14 Plan-and-Execute UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `plan_and_execute` graph.
- Example navigation includes `14 Plan-and-Execute UI`.
- The UI provides a default API URL, task textarea or input, task sample buttons, and a primary run button named like `Run plan`.
- If supported by the graph, the UI exposes a run mode control for `normal`, `replan`, and `stop`, or a visible `Control State` panel that reflects the selected control mode.

## User Actions

1. Open the app and select `14 Plan-and-Execute UI`.
2. Confirm the default API URL and task input are present.
3. Confirm at least one task sample button is visible.
4. Confirm replan or stop controls are visible when the UI exposes them.
5. Keep the default task and click `Run plan`.
6. While the run is active, confirm visible replan or stop controls are disabled or that `Control State` reflects the current control mode.
7. Wait for `Run complete`.
8. Review `Execution Status`, `Plan Steps`, `Executor Output` or `Completed Steps`, `Replan / Stop Controls` or `Control State`, `Final Answer`, `Final State`, and `Raw Stream Events`.

## Expected UI States

- Status changes through planning and execution lifecycle states and reaches `Run complete`.
- `Execution Status` shows planner, executor, control, or finalization progress.
- `Plan Steps` displays at least two step cards before or by run completion.
- Each plan step card shows a stable id or step number, title or description, status, and result or error when complete.
- Active, completed, pending, and failed statuses are visually or textually distinct.
- Completed step cards show executor results without relying on exact model wording.
- `Executor Output` or `Completed Steps` shows completed work from at least one executor step.
- Replan or stop mode is reflected in graph state and UI control state when the graph supports those controls.
- `Final Answer` summarizes completed steps and is populated after execution completes.
- `Final State` contains `plan_steps`, `completed_steps`, `remaining_steps`, and `control_mode`.
- `Raw Stream Events` contains update payloads for planner, executor, and finalization activity.

## Backend Assertions

- The SDK client streams against graph id `plan_and_execute`.
- The planner emits a structured plan before all executor work is complete.
- Plan step objects include `id`, `title`, `status`, `result`, and `error` or equivalent fields.
- Executor updates move steps through pending, active or running, completed, and failed or error states.
- Replan and stop control modes are stored in graph state when requested or exposed by the UI.
- Final graph state includes `plan_steps`, `completed_steps`, `remaining_steps`, `control_mode`, final answer text, and trace data.
- Raw stream event output includes `updates` chunks sufficient to inspect planner, executor, control, and finalize transitions.

## Subagent Tracking Notes

- Implementation-tracking subagents should keep example 14 marked in progress until the React route, `plan_and_execute` graph registration, and this E2E spec pass together.
- The E2E subagent should update `progress/e2e-progress.md` after the broader workflow allows progress-file edits.
- Mark the E2E status complete only after a Playwright MCP run verifies plan cards, executor completion, control-mode state, final answer, and raw stream events against the real OpenAI-backed graph.

## Cleanup

- The browser flow may leave in-memory thread and run data in the dev server.
- No persistent external data is created.
- Test isolation should clear page storage between Playwright tests if the UI stores selected sample, selected run mode, expanded step cards, or run results locally.
