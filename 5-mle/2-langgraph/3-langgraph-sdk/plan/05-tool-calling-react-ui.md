# 05 Tool Calling ReAct UI

## Coding Scope

- Graph: `graphs/05_tool_calling_react.py` adapts `03_tool_node`.
- Frontend: `src/examples/05-tool-calling-react-ui/` displays tool calls inside a chat-style flow.

## Implementation Plan

1. Provide a simple deterministic tool plus one LLM-selected tool path.
2. Stream assistant messages and tool events as separate UI items.
3. Render tool cards with name, arguments, status, result, and error state.
4. Add sample prompts that reliably trigger the tool.

## SDK And State Notes

Use `streamMode: ["messages", "updates"]` so assistant text arrives from the message stream while tool call metadata and tool result messages arrive from update chunks. Normalize tool call metadata from AI messages and tool result messages. Keep raw args/result available for inspection.

## Risks

- Tool call metadata differs between model providers and message wrappers.
- Tool failures must remain visible and not be collapsed into a generic assistant error.

## Acceptance Criteria

- Tool calls are visually separate from assistant text.
- In-progress, success, and error tool states are visible.
- Final assistant response references the tool result.
