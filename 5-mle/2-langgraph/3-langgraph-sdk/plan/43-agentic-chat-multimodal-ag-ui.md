# 43 Agentic Chat Multimodal AG-UI

## Coding Scope

- Graph: `graphs/43_agentic_chat_multimodal_ag_ui.py` implements a Python multimodal chat agent that can reason over image input.
- Frontend: `src/examples/43-agentic-chat-multimodal-ag-ui/` renders CopilotKit chat with image attachment, preview, and analysis results.
- Runtime: reuse the shared CopilotKit runtime and Python LangGraph server.

## Implementation Plan

1. Add an `agentic_chat_multimodal` graph with message handling for text plus image/media content.
2. Use the shared model factory with a multimodal-capable model configuration when available.
3. Add React image upload/preview controls and pass the selected image into the CopilotKit/LangGraph message flow.
4. Render upload state, thumbnail preview, assistant analysis, and any structured observations.
5. Provide a deterministic sample image or fixture path for E2E planning.
6. Register graph, runtime agent, example metadata, and route as example 43.

## SDK And State Notes

Keep binary image data out of persistent app state when possible. Use data URLs or uploaded references consistently with the existing multimodal image example and the CopilotKit transport constraints.

## Risks

- Runtime payload size limits can reject large images.
- The configured default model may not support multimodal input.
- Browser file input behavior requires a fixture-based E2E path.

## Acceptance Criteria

- The Agentic Chat Multimodal AG-UI example appears as example 43 in the navigation.
- Users can attach an image and see a preview before sending.
- The graph receives the image content and returns an image-aware response.
- Upload errors or unsupported file types show a visible error.
- A text-only message still works in the same chat.
