# 15 Reflection Evaluator Loop UI

## Coding Scope

- Graph: `graphs/15_reflection_evaluator_loop.py` adapts `12_1_reflection`, `12_2_reflection`, `22_evaluator_loop`, and `23_verification_flow`.
- Frontend: `src/examples/15-reflection-evaluator-loop-ui/` renders iteration history.

## Implementation Plan

1. Create a bounded loop with draft, critique, rewrite, and evaluation nodes.
2. Store each iteration as structured state.
3. Render draft text, evaluator score, feedback, retry count, and final pass/fail.
4. Provide prompts that trigger at least one retry.

## SDK And State Notes

Expose max retries and stop reason. Do not hide rejected drafts.

## Risks

- Looping graphs can run longer than expected; enforce max iterations.
- Evaluation scores may be subjective, so show feedback and stop reason together.

## Acceptance Criteria

- Iterations appear in chronological order.
- Feedback explains why a draft was retried.
- Final pass/fail condition is explicit.
