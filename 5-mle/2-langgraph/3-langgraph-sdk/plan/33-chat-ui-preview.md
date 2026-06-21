# 33 Chat UI Preview

## Coding Scope

- Graph: `graphs/33_chat_ui_preview.py` models a UI generation assistant with tool approval and artifact versions.
- Frontend: `src/examples/33-chat-ui-preview/` provides chat, code, live preview, and diff controls.

## Implementation Plan

1. Store generated React component code as an artifact.
2. Render code and live preview in a sandboxed preview frame.
3. Show proposed diffs and allow apply/revert.
4. Track artifact versions and execution errors.

## SDK And State Notes

Never execute arbitrary code outside the preview sandbox. Keep generated code, preview status, and errors structured.

## Risks

- Preview execution must be isolated from the main app.
- Generated UI can fail to compile; errors should stay inside the preview workflow.

## Acceptance Criteria

- Chat requests produce previewable UI changes.
- Diffs can be applied or reverted.
- Preview errors are shown without breaking the main app.
