# 49 Loop Engineering Harness UI E2E Plan

## Setup

- Start LangGraph dev with the `loop_engineering_harness` graph registered.
- Start the Vite frontend with `VITE_LANGGRAPH_API_URL` pointing at the local LangGraph API.

## User Actions

1. Open the app and select `49 Loop Engineering Harness`.
2. Select the `webhook` trigger.
3. Use the default task and run the harness.
4. Wait for `Run complete`.

## Expected UI States

- The four loop cards are visible: Agent loop, Verification loop, Event-driven loop, and Hill-climbing loop.
- The attempt timeline contains at least two attempts when max attempts is 3.
- The first attempt has a fail/retry verifier result.
- A final answer and stop reason are visible.
- The improvement panel contains prompt, rubric, and tool suggestions.
- Raw stream events include custom loop events.

## Backend Assertions

- Final state contains `attempts`, `verification_results`, `trace_events`, `improvement_suggestions`, `final_answer`, and `stop_reason`.
- The final verification result passes when the quality threshold is reachable.

## Cleanup

No persistent data is created. In-memory LangGraph threads may remain after the run.
