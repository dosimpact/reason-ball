# 34 Chat Data Analysis Canvas

## Coding Scope

- Graph: `graphs/34_chat_data_analysis_canvas.py` combines code tool execution, structured output, retry, and sandboxing.
- Frontend: `src/examples/34-chat-data-analysis-canvas/` renders dataset, generated code, charts, logs, and insights.

## Implementation Plan

1. Add CSV upload and dataframe preview.
2. Generate analysis code from chat instructions.
3. Execute code in a controlled environment and capture logs, tables, and chart artifacts.
4. Render insight summary with links to generated outputs.

## SDK And State Notes

Keep uploaded data metadata, generated code, execution results, chart specs, and retry state separate.

## Risks

- Uploaded CSV data can be large or malformed; validate before execution.
- Analysis code execution must be sandboxed and time-limited.

## Acceptance Criteria

- A CSV can be uploaded and previewed.
- Generated analysis produces visible table or chart output.
- Failed code execution triggers retry or clear error display.
