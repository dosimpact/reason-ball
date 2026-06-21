# 30 Chat Document Artifact

## Coding Scope

- Graph: `graphs/30_chat_document_artifact.py` combines document editing with reflection, evaluator loop, and structured output.
- Frontend: `src/examples/30-chat-document-artifact/` renders a document canvas with chat controls.

## Implementation Plan

1. Represent document sections as structured artifact state.
2. Add chat commands for tone, length, grammar, section edits, and AI comments.
3. Run evaluator passes for quality checks.
4. Render an editable document canvas where users can directly change title, summary, and section text.
5. Support `save_user_edit` and `ai_revise` actions so user edits and AI revisions both update the same artifact state before approval.
6. Render version history and section-level changes.

## SDK And State Notes

Keep document content, comments, suggested edits, direct user edits, AI revisions, and accepted versions separate. Approval requests send the current canvas payload so unsaved local edits are not dropped.

## Risks

- Long document edits can obscure exact changes without section-level diffs.
- Evaluator output should guide edits without overwriting user-approved text.

## Acceptance Criteria

- Users can request tone or grammar changes from chat.
- Users can directly edit the document canvas and save those edits into graph state.
- AI can revise the current user-edited canvas on the same thread.
- Section-level edits are visible before acceptance.
- Document versions can be compared.
