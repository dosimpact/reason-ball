# 23 Thinking Renderer

## Coding Scope

- Graph: `graphs/23_thinking_renderer.py` emits public reasoning summaries or status events only.
- Frontend: `src/examples/23-thinking-renderer/` renders collapsible thinking summaries.

## Implementation Plan

1. Use provider-supported reasoning summary or graph-authored status messages.
2. Separate public thinking/status content from final answer content.
3. Render collapsible blocks with step labels and timestamps.
4. Add guardrails so hidden chain-of-thought is never requested or displayed.

## SDK And State Notes

Use explicit `reasoning_summary` or `status` fields. Do not store private model reasoning.

## Risks

- The UI must not request, infer, or expose hidden chain-of-thought.
- Provider support for reasoning summaries can vary by model.

## Acceptance Criteria

- Users see useful progress context before the final answer.
- Final answer remains separate from thinking/status blocks.
- The implementation does not expose hidden chain-of-thought.
