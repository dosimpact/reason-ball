# 18 Retry Error Degradation UI

## Coding Scope

- Graph: `graphs/18_retry_error_degradation.py` adapts `19_retry_policy` and graceful degradation patterns.
- Frontend: `src/examples/18-retry-error-degradation-ui/` exposes retry and fallback behavior.

## Implementation Plan

1. Create a graph path that can intentionally fail before succeeding or falling back.
2. Emit retry attempt, backoff, error, fallback, and final status updates.
3. Render a retry timeline and final result panel.
4. Include controls for normal, flaky, and forced-failure modes.

## SDK And State Notes

Keep errors structured with node, attempt, message, recoverable flag, and fallback result.

## Risks

- Random failures make tests flaky; include deterministic failure modes.
- Retry errors should be educational, not hidden behind final fallback success.

## Acceptance Criteria

- Retry attempts are counted and visible.
- Final failure is distinguishable from fallback success.
- Users can reproduce the error path deterministically.
