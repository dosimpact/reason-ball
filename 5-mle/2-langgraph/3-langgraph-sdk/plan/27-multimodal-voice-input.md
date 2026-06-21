# 27 Multimodal Voice Input

## Coding Scope

- Graph: `graphs/27_multimodal_voice_input.py` receives transcribed or uploaded voice input.
- Frontend: `src/examples/27-multimodal-voice-input/` supports record/upload and transcription preview.

## Implementation Plan

1. Implement browser audio capture or file upload with duration display.
2. Transcribe audio before or inside the graph depending on provider support.
3. Let the user review transcription before final graph run.
4. Show final answer tied to the original audio input.

## SDK And State Notes

Store audio metadata, transcription text, confidence when available, and graph response. Use small fixtures for tests.

## Risks

- Browser microphone permissions can make E2E flaky; include upload-based fallback.
- Audio transcription model availability depends on provider configuration.

## Acceptance Criteria

- Voice input becomes text or structured input for a graph run.
- Users can inspect transcription before sending.
- Upload/record errors are visible and recoverable.
