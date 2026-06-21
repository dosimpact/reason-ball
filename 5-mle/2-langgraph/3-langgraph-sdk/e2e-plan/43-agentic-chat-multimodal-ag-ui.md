# 43 Agentic Chat Multimodal AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full image analysis requires a multimodal-capable model, CopilotKit attachments, runtime, and Python LangGraph server.

## Surface Checks

- Verify image preview panel renders.
- Verify `Sample` creates a deterministic preview image.
- Verify `Reset` clears preview metadata.
- Verify suggestions include image and text-only prompts.

## Main Flow

1. Select example 43.
2. Assert `data-testid="multimodal-preview-panel"` is visible.
3. Click `Sample` and assert sample image metadata appears.
4. Click `Reset` and assert metadata returns to none.

## Backend Assertions

- Live execution should target graph id `agentic_chat_multimodal`.
- Image observation renderer should handle `record_image_observations`.

## Cleanup

- Sample image is generated in browser memory only.
