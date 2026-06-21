# 26 Multimodal Image Input E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- The LangGraph server exposes the `multimodal_image_input` graph.
- Example navigation includes `26 Multimodal Input: Image`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.
- The browser test can upload a generated tiny PNG fixture, or use the sample image button if the implementation supplies one instead.

## User Actions

1. Open the app and select `26 Multimodal Input: Image`.
2. Confirm the default API URL, image prompt input, image upload control, sample image button, `Run image analysis`, `Reset`, and all image result panels are present.
3. Upload the generated PNG fixture or click the sample image button.
4. Append a unique E2E marker to the image prompt.
5. Click `Run image analysis`.
6. Wait for the preview image, streamed analysis, region notes, image metadata, final state, and raw stream events to populate.

## Expected UI States

- `Image Preview` shows the selected or uploaded image before or during analysis.
- `Image Analysis` contains a non-empty analysis response.
- `Region Notes` contains object, area, region, or observation notes from the stream or final state.
- `Image Metadata` contains file, MIME type, size, dimensions, or equivalent image metadata.
- `Final State` includes the marked prompt plus image metadata, observations, region notes, and `final_status`.
- `Raw Stream Events` shows both `updates` and `custom` events and includes image-related payloads.

## Backend Assertions

- Stream requests target graph id `multimodal_image_input`.
- Stream mode includes `updates` and `custom`.
- The stream request body includes the unique E2E marker appended to the image prompt.
- Custom stream events include image, metadata, analysis, observation, or region payloads.
- Final graph state preserves the marked prompt and reports image metadata, observations, region notes, and `final_status`.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique prompt marker.
- The uploaded image fixture is provided from memory through Playwright and is not committed as a binary file.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
