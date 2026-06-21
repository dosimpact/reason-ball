# 12 Structured Output UI

## Coding Scope

- Graph: `graphs/12_structured_output.py` adapts `09_structured_output`.
- Frontend: `src/examples/12-structured-output-ui/` renders JSON and form/table views.

## Implementation Plan

1. Define a schema for a practical extraction task.
2. Ask the model for structured output and validate it server-side.
3. Render raw JSON, validation status, and a human-friendly table or form.
4. Include invalid or partial result handling for learning.

## SDK And State Notes

Return schema name, parsed object, validation errors, and original model text when available.

## Risks

- Model output can be partially valid; preserve raw output for debugging.
- Schema changes can break tests unless fixtures and UI labels are updated together.

## Acceptance Criteria

- Valid structured output appears in raw and formatted views.
- Validation success or failure is explicit.
- The UI preserves enough raw data to debug malformed output.
