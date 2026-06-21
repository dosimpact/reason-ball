# 15 Reflection / Evaluator Loop UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `reflection_evaluator_loop` graph.
- Example navigation includes `15 Reflection / Evaluator Loop UI`.
- The UI provides a default API URL, prompt or request textarea, max attempts controls, and a primary run button named like `Run reflection loop`.
- The SDK client streams with `updates` and `custom` modes so evaluator-loop progress and custom node signals are visible.
- The default prompt and max-attempt settings should force one retry before success or max-attempt stop.

## User Actions

1. Open the app and select `15 Reflection / Evaluator Loop UI`.
2. Confirm the default API URL and prompt or request textarea are present.
3. Confirm max attempts controls are visible and set to at least `2`.
4. Keep the default prompt and click `Run reflection loop`.
5. Wait for `Run complete`.
6. Review `Loop Status`, `Iteration History`, `Draft Comparison`, `Evaluator Feedback`, `Final Answer`, `Final State`, and `Raw Stream Events`.

## Expected UI States

- Status changes through the draft, evaluation, reflection or retry, and finalization lifecycle and reaches `Run complete`.
- `Loop Status` shows current iteration, max attempts, verdict, score, and stop reason or pass/fail status.
- `Iteration History` shows at least two iteration cards for the default run.
- Each iteration card shows an iteration number, draft text or summary, evaluator verdict, score, and feedback.
- Rejected drafts remain visible after later retries complete.
- The first iteration visibly shows a rejected or failed verdict, low score, retry state, or evaluator feedback that explains why the draft was retried.
- A later iteration visibly shows a passed verdict, improved score, final state, or a max-attempt stop reason.
- `Draft Comparison` shows the rejected draft and final draft or revision delta without relying on exact model wording.
- `Evaluator Feedback` shows structured feedback, critique, rubric notes, or improvement guidance from the evaluator.
- `Final Answer` is populated after completion and reflects the accepted final draft or the max-attempt fallback.
- `Final State` contains `iterations`, `stop_reason`, `current_iteration`, `verdict`, and related evaluator data such as score or feedback.
- `Raw Stream Events` contains `updates` and `custom` stream events with `draft`, `evaluate`, and `finalize` signals.

## Backend Assertions

- The SDK client streams against graph id `reflection_evaluator_loop`.
- Stream mode includes both `updates` and `custom`.
- The graph enforces max attempts and writes the selected max attempts value into state.
- The default run produces at least two iteration records by forcing one evaluator rejection before pass or max-attempt termination.
- Iteration records include draft content, evaluator score, verdict, feedback, retry decision, and iteration number.
- Rejected drafts are retained in state rather than overwritten by rewritten drafts.
- Final graph state includes `iterations`, `stop_reason`, `current_iteration`, `verdict`, final answer text, score, feedback, and trace data.
- Raw stream event output includes enough `custom` and `updates` chunks to inspect draft, evaluate, retry or reflect, and finalize transitions.

## Subagent Tracking Notes

- Implementation-tracking subagents should keep example 15 marked in progress until the React route, `reflection_evaluator_loop` graph registration, and this E2E spec pass together.
- The E2E subagent should update `progress/e2e-progress.md` after the broader workflow allows progress-file edits.
- Mark the E2E status complete only after a Playwright MCP run verifies retry iteration cards, retained rejected drafts, evaluator feedback, final state fields, and raw stream events against the real OpenAI-backed graph.

## Cleanup

- The browser flow may leave in-memory thread and run data in the dev server.
- No persistent external data is created.
- Test isolation should clear page storage between Playwright tests if the UI stores selected prompt, max attempts, expanded iteration cards, comparison state, or run results locally.
