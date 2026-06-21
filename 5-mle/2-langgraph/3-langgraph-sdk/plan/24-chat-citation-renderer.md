# 24 Chat Citation Renderer

## Coding Scope

- Graph: `graphs/24_chat_citation_renderer.py` adapts `10_rag` and `24_qa_pipeline`.
- Frontend: `src/examples/24-chat-citation-renderer/` renders citations inside chat answers.

## Implementation Plan

1. Return answer spans or citation markers linked to source ids.
2. Render citation chips inline with hover or side-panel preview.
3. Highlight the matching document card when a citation is selected.
4. Support external links and local document snippets.

## SDK And State Notes

Keep citation metadata separate from answer text so rendering does not depend on brittle string parsing.

## Risks

- Citation spans can drift if answer text is regenerated after metadata is built.
- External links need safe rendering and should open predictably.

## Acceptance Criteria

- Each citation chip opens or highlights its source.
- The source list includes title, URL or id, and snippet.
- Missing citation metadata degrades to plain answer text.
