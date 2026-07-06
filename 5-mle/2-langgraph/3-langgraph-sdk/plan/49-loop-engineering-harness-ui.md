# 49 Loop Engineering Harness UI

## Coding Scope

- Graph: `graphs/49_loop_engineering_harness.py` models the loop stack from LangChain's "The Art of Loop Engineering" as a deterministic local graph.
- Frontend: `src/examples/49-loop-engineering-harness-ui/` renders trigger intake, agent work, verification retries, event traces, and hill-climbing suggestions.

## Implementation Plan

1. Normalize a manual, webhook, or cron-style trigger into a shared run event.
2. Run an agent work node that creates a draft, records mock tool calls, and emits trace events.
3. Evaluate the draft with a rubric, route failed attempts back through the agent loop, and stop at pass or max attempts.
4. Analyze the run trace to generate prompt, rubric, and tool improvement suggestions.
5. Register the graph, route, metadata, and progress records as example 49.

## Graph Requirements

- State includes `task`, `trigger`, `attempts`, `tool_calls`, `verification_results`, `trace_events`, `improvement_suggestions`, `final_answer`, and `stop_reason`.
- The first attempt should fail by design when retry budget allows, so the verification loop is visible without relying on an external model.
- Tool calls are local mock calls only; the example must not require external services or LangSmith deployment features.
- Custom events use `type: "loop_engineering_event"` and identify the active loop.

## Frontend Behavior

- The screen shows controls on the left, a four-loop stack in the center, and trace/analysis panels on the right.
- Users can choose `manual`, `webhook`, or `cron`, set `max_attempts`, set `quality_threshold`, and run the graph.
- Attempt cards show draft text, tool calls, verifier score, pass/fail verdict, and retry reason.
- Hill-climbing suggestions are shown separately from the final answer.

## SDK And State Notes

Use `updates`, `values`, and `custom` stream modes. The final state is authoritative; custom events are used for the live timeline only. Treat attempts and verifier results as replaceable state snapshots from the graph.

## Risks

- The concept overlaps with examples 15, 20, and 48, so the UI must emphasize the complete loop harness rather than a single evaluator loop.
- Too much raw state can make the page hard to scan; keep the primary panels focused on loop status and move raw payloads to collapsible event logs.

## Acceptance Criteria

- Example 49 appears in navigation as `Loop Engineering Harness`.
- A webhook or cron trigger run shows all four loop categories.
- At least one retry appears when `max_attempts` is greater than 1.
- Final answer, stop reason, trace events, verification results, and improvement suggestions render without external API keys.
