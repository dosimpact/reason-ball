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

---

## 한국어

# 13 RAG QA UI

## 코딩 범위

- 그래프: `graphs/13_rag_qa.py`는 `10_rag` 및 `24_qa_pipeline`를 적용합니다.
- 프런트엔드: `src/examples/13-rag-qa-ui/`는 답변, 검색된 문서 및 인용문을 표시합니다.

## 구현 계획

1. 결정론적 검색을 위한 소규모 로컬 문서 테스트용 샘플 세트를 제공합니다.
2. 인용 메타데이터를 검색하고 답변하고 반환하는 그래프를 작성합니다.
3. 검색된 문서를 순위, 점수, 조각 및 소스 ID로 렌더링합니다.
4. 답변 인용 칩을 문서 카드에 연결합니다.

## SDK 및 상태 참고 사항

상태에는 질문, 검색된 문서, 답변, 인용 및 유용한 문서가 없는 경우 대체 이유가 포함되어야 합니다.

## 위험

- 검색 품질은 임베딩에 따라 달라질 수 있습니다. E2E에는 작은 결정론적 고정 코퍼스를 사용합니다.
- 인용 ID는 답변 렌더링 및 문서 카드 전체에서 안정적으로 유지되어야 합니다.

## 승인 기준

- UI는 어떤 문서가 답변을 뒷받침하는지 보여줍니다.
- 인용 칩은 소스 카드를 탐색하거나 강조 표시합니다.
- 문서 없는 폴백이 표시되고 테스트 가능합니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `RagQaExample.tsx`: screen composition and citation DOM navigation.
- `useRagQa.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useRagQaState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed RetrievalStatusPanel, AnswerPanel, RetrievedDocumentsPanel, CitationTrailPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `RagQaExample.tsx`: 화면 조합과 인용 문서로 이동하는 DOM 처리.
- `useRagQa.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useRagQaState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
