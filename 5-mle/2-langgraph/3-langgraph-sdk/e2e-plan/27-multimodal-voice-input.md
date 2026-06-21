# 27 Multimodal Voice Input E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- The LangGraph server exposes the `multimodal_voice_input` graph.
- Example navigation includes `27 Multimodal Input: Voice`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.
- Browser automation avoids microphone permissions by using a sample audio button when available, otherwise uploading an in-memory WAV fixture.

## User Actions

1. Open the app and select `27 Multimodal Input: Voice`.
2. Confirm the default API URL, voice prompt input, upload/sample audio fallback, `Run voice analysis`, `Reset`, and voice result panels are present.
3. Provide audio through the sample audio control or generated WAV upload.
4. Append a unique E2E marker to the voice prompt.
5. Trigger transcription if the UI has an explicit transcription step.
6. Click `Run voice analysis`.
7. Wait for audio preview/metadata, transcription preview, final answer or response, final state, and raw stream events to populate.

## Expected UI States

- `Audio Preview` shows the selected sample/uploaded audio or equivalent selected-audio details.
- `Audio Metadata` shows file, MIME type, size, duration, source, or equivalent audio metadata.
- `Transcription Preview` contains non-empty transcription text for user review.
- `Final Answer` or `Voice Response` contains a non-empty graph response tied to the voice input.
- `Final State` includes the marked prompt plus audio metadata, transcription text, and `final_status`.
- `Raw Stream Events` shows both `updates` and `custom` events and includes audio/transcription-related payloads.

## Backend Assertions

- Stream requests target graph id `multimodal_voice_input`.
- Stream mode includes `updates` and `custom`.
- The stream request body includes the unique E2E marker appended to the prompt.
- The stream request body includes audio metadata such as file name, MIME type, size, duration, or source.
- Custom stream events include audio, metadata, transcription, response, or final-status payloads.
- Final graph state preserves the marked prompt and reports audio metadata, transcription, response, and `final_status`.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique prompt marker.
- The uploaded audio fixture is generated in memory through Playwright and is not committed as a binary file.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
