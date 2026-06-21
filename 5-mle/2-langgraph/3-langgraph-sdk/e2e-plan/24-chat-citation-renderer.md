# 24 Chat Citation Renderer E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` includes a valid `OPENAI_API_KEY` if the provider-backed answer path is used.
- The LangGraph server exposes the `chat_citation_renderer` graph.
- Example navigation includes `24 Chat Citation Renderer`.
- The SDK client streams with both `updates` and `custom` modes.

## User Actions

1. Open the app and select `24 Chat Citation Renderer`.
2. Confirm the default API URL, `Citation question` input, citation sample buttons, run/reset buttons, citation panels, final panels, and debug panel are present.
3. Click `Use evidence sample`, append a unique E2E marker to the citation question, and click `Run citation renderer`.
4. Wait for citation status and streamed citation rendering to populate.
5. Confirm the chat answer renders inline citation chips or buttons such as `[doc-rag]`.
6. Click the `[doc-rag]` citation chip.
7. Confirm `Citation Preview` opens for the selected citation and the matching source document is highlighted.
8. Wait for `Citation Map`, `Final Answer`, `Final State`, and `Raw Stream Events` to populate.

## Expected UI States

- `Citation Status` shows lifecycle status for the current renderer run and reaches a completed or final state.
- `Chat Answer With Citations` contains a non-empty answer and renders inline citation controls such as `[doc-rag]`.
- `Citation Preview` updates after a citation is clicked and shows the selected citation/source context.
- `Source Documents` lists source documents including `doc-rag`; after clicking the chip, the matching source document is visibly highlighted or selected.
- `Citation Map` connects sentence or segment identifiers to source identifiers.
- `Final Answer` contains a non-empty assistant response without relying on raw stream payload text.
- `Final State` includes `question`, `sources`, `answer_segments`, `citations`, `citation_events`, `answer`, `final`, and `final_status`.
- `Raw Stream Events` shows both `updates` and `custom` events and includes citation/source payloads.

## Backend Assertions

- Stream requests target graph id `chat_citation_renderer`.
- Stream mode includes `updates` and `custom`.
- The stream request body includes the unique E2E marker appended to the citation question.
- Custom stream events include citation/source lifecycle payloads before or alongside final state updates.
- Final graph state includes the expected citation renderer keys and preserves the original marked question.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique citation question marker.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
