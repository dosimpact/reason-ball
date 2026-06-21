# 13 RAG / QA UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `rag_qa` graph.
- Example navigation includes `13 RAG / QA UI`.
- The UI provides a default API URL, question textarea or input, question sample buttons, and a primary run button named like `Run RAG QA`.

## User Actions

1. Open the app and select `13 RAG / QA UI`.
2. Confirm the default API URL and question input are present.
3. Confirm at least one question sample button is visible.
4. Keep the default question and click `Run RAG QA`.
5. Wait for `Run complete`.
6. Review `Retrieval Status`, `Answer`, `Retrieved Documents`, `Citation Trail` or `Citations`, `Final State`, and `Raw Stream Events`.
7. Click an answer citation chip such as `[doc-rag]` or `[doc-sdk]`.
8. Confirm the matching retrieved document card is highlighted or focused.

## Expected UI States

- Status changes through the run lifecycle and reaches `Run complete`.
- `Retrieval Status` shows retrieval progress, completion state, document count, and either matched source ids or a visible no-document fallback reason.
- `Answer` is populated from the real OpenAI-backed graph run and includes citation chips or citation text such as `[doc-rag]` or `[doc-sdk]`.
- `Retrieved Documents` shows one card per retrieved document when matches exist.
- Each retrieved document card shows rank, score, source id, and snippet text.
- `Citation Trail` or `Citations` lists citation records with stable labels that match retrieved document source ids.
- Clicking a citation chip moves focus to, scrolls to, or visually highlights the matching document card.
- If the default or a targeted no-match question returns no useful documents, the UI shows a no-document fallback instead of empty answer and document regions.
- `Final State` contains question, retrieved docs, answer, citations, citation validation status, fallback reason when applicable, and final summary data.
- `Raw Stream Events` contains update payloads for retrieval, context construction, answer generation, citation checking, fallback, and finalization.

## Backend Assertions

- The SDK client streams against graph id `rag_qa`.
- The graph uses a deterministic fixture corpus with stable source ids such as `doc-rag` and `doc-sdk`.
- Retrieval returns ranked document records with `rank`, `score`, `source`, `snippet`, and `id`.
- Answer generation cites only retrieved document ids in square-bracket labels.
- Citation checking writes a positive validation state when answer citations match retrieved document ids.
- No-match retrieval writes a fallback reason and produces a grounded no-document fallback answer.
- Final graph state includes `question`, `retrieved_docs`, `answer`, `citations`, `citation_ok`, `qa_status`, `fallback_reason`, `final`, and trace data.
- Raw stream event output includes `updates` chunks sufficient to inspect retrieval, citation, answer, fallback, and final-state transitions.

## Subagent Tracking Notes

- Implementation-tracking subagents should keep example 13 marked in progress until the React route, `rag_qa` graph registration, and this E2E spec pass together.
- The E2E subagent should update `progress/e2e-progress.md` after the broader workflow allows progress-file edits.
- Mark the E2E status complete only after a Playwright MCP run verifies citation-card linking against the real OpenAI-backed graph.

## Cleanup

- The browser flow may leave in-memory thread and run data in the dev server.
- No persistent external data is created.
- Test isolation should clear page storage between Playwright tests if the UI stores selected sample, highlighted citation, expanded document cards, or run results locally.
