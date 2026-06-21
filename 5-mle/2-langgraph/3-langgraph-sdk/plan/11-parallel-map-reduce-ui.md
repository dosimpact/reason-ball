# 11 Parallel Map-Reduce UI

## Coding Scope

- Graph: `graphs/11_parallel_map_reduce.py` adapts `08_map_reduce` and `14_parallel_branches`.
- Frontend: `src/examples/11-parallel-map-reduce-ui/` shows fan-out worker progress and reducer output.

## Implementation Plan

1. Create a fan-out graph that processes several items independently.
2. Emit worker start, success, failure, and result updates.
3. Render worker cards ordered by item while completion events arrive asynchronously.
4. Show reducer input list and final combined result.

## SDK And State Notes

Use custom or update events with stable worker ids. Partial failure should remain inspectable.

## Risks

- Parallel events may complete in nondeterministic order; rendering must key by worker id.
- Partial failures should not block display of successful worker results.

## Acceptance Criteria

- Worker progress is visible independently.
- Results accumulate as workers finish.
- Reducer output is shown separately from individual worker outputs.
