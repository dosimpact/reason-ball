# 28 Multimodal Voice Output

## Coding Scope

- Graph: `graphs/28_multimodal_voice_output.py` produces text plus audio output metadata.
- Frontend: `src/examples/28-multimodal-voice-output/` renders an inline audio player.

## Implementation Plan

1. Generate a normal assistant text response first.
2. Produce audio from the response with a provider-supported TTS path.
3. Store audio URL or blob metadata with the message.
4. Render play, pause, loading, and error states inside the chat bubble.

## SDK And State Notes

Keep audio generation errors separate from text response success. Avoid autoplay.

## Risks

- TTS latency may be high; the UI needs explicit generating and failed states.
- Audio blobs or URLs need cleanup to avoid memory leaks.

## Acceptance Criteria

- Each generated audio response is linked to its text answer.
- Audio can be played and stopped in the UI.
- Text output still works if audio generation fails.
