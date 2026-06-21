# 28 Multimodal Voice Output E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- The LangGraph server exposes the `multimodal_voice_output` graph.
- Example navigation includes `28 Multimodal Output: Voice`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.
- Browser automation does not auto-play audio; it verifies the generated player, download surface, and metadata.

## User Actions

1. Open the app and select `28 Multimodal Output: Voice`.
2. Confirm the default API URL, prompt input, voice selector, output format selector, `Run voice output`, `Reset`, and result panels are present.
3. Append a unique E2E marker to the prompt.
4. Keep or select deterministic voice and audio format options when controls expose them.
5. Click `Run voice output`.
6. Wait for generated text, audio player/preview, audio/download metadata, final state, and raw stream events to populate.

## Expected UI States

- `Generated Text` or equivalent assistant response panel contains non-empty text.
- `Audio Output`, `Audio Preview`, or `Audio Player` shows a playable generated audio surface.
- Audio metadata includes selected voice, selected format or MIME type, duration/size/source/download metadata, or equivalent output details.
- A download link or button is available for the generated audio.
- `Final State` includes the marked prompt, generated text, audio metadata, selected voice, output format, and `final_status`.
- `Raw Stream Events` shows both `updates` and `custom` events and includes text/audio/TTS metadata payloads.

## Backend Assertions

- Stream requests target graph id `multimodal_voice_output`.
- Stream mode includes `updates` and `custom`.
- The stream request body includes the unique E2E marker appended to the prompt.
- The stream request body includes selected voice metadata.
- The stream request body includes selected format or MIME metadata.
- Custom stream events include generated text, audio, TTS, metadata, download, or final-status payloads.
- Final graph state preserves the marked prompt and reports generated text, audio metadata, selected voice, output format, and `final_status`.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique prompt marker.
- Generated audio is not auto-played during automation.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
