# 13 RAG QA UI

## Coding Scope

- Graph: `graphs/13_rag_qa.py` adapts `10_rag` and `24_qa_pipeline`.
- Frontend: `src/examples/13-rag-qa-ui/` shows answer, retrieved documents, and citations.

## Implementation Plan

1. Provide a small local document fixture set for deterministic retrieval.
2. Build a graph that retrieves, answers, and returns citation metadata.
3. Render retrieved documents with rank, score, snippet, and source id.
4. Link answer citation chips to document cards.

## SDK And State Notes

State should include question, retrieved docs, answer, citations, and fallback reason when no document is useful.

## Risks

- Retrieval quality may vary with embeddings; use a small deterministic fixture corpus for E2E.
- Citation ids must remain stable across answer rendering and document cards.

## Acceptance Criteria

- The UI shows which documents supported the answer.
- Citation chips navigate to or highlight source cards.
- No-document fallback is visible and testable.
