# 29 Chat Code Editor

## Coding Scope

- Graph: `graphs/29_chat_code_editor.py` models a coding assistant with tool calls, approval, streaming, and checkpoints.
- Frontend: `src/examples/29-chat-code-editor/` provides chat plus code artifact canvas.

## Implementation Plan

1. Define artifact state for files, proposed diffs, test logs, and approval status.
2. Build chat flow that proposes code changes before applying them.
3. Render editor, diff viewer, execution log, and approve/reject controls.
4. Checkpoint artifact versions after accepted changes.

## SDK And State Notes

Treat file edits as proposed artifacts until approval. Use deterministic sample files for tests.

## Risks

- Generated code must not be applied without explicit approval.
- Running arbitrary code requires sandboxing and strict fixture scope.

## Acceptance Criteria

- Chat requests produce visible diff proposals.
- User approval is required before applying changes.
- Test output and artifact version history are visible.
