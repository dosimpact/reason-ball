# 19 Long Context UI

## Coding Scope

- Graph: `graphs/19_long_context.py` adapts `21_long_context`.
- Frontend: `src/examples/19-long-context-ui/` shows recent messages and summarized history.

## Implementation Plan

1. Build a chat graph that summarizes older context after a threshold.
2. Store summary metadata and retained message ids.
3. Render recent messages, summarized past context, removed messages, and summary creation time.
4. Provide a seed conversation action for faster testing.

## SDK And State Notes

Expose summary, source message range, retained message count, and last compaction run id.

## Risks

- Context compaction thresholds can be hard to trigger manually; include a seed action.
- Summaries should not replace recent messages in the UI unexpectedly.

## Acceptance Criteria

- The UI shows when context compaction happens.
- Summary and recent messages are visually separate.
- Removed or summarized messages are traceable.
